import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFirstValue, requestAiStage } from './aiStageClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mediapipeScriptPath = path.join(__dirname, 'mediapipe_face_landmarks.py');

const getEnvValue = (key, fallback = '') => String(process.env[key] ?? fallback).trim();

const normalizePoint = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const x = Number(value.x ?? value[0]);
  const y = Number(value.y ?? value[1]);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
};

const normalizeBoundingBox = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return { x, y, width, height };
};

const normalizeAlignmentPayload = (payload, provider, defaultModel) => {
  const leftEye = normalizePoint(
    findFirstValue(payload, ['leftEye', 'data.leftEye', 'eyes.left', 'data.eyes.left']),
  );
  const rightEye = normalizePoint(
    findFirstValue(payload, ['rightEye', 'data.rightEye', 'eyes.right', 'data.eyes.right']),
  );

  if (!leftEye || !rightEye) {
    throw new Error('Facial Landmarks could not detect a face in the target image.');
  }

  return {
    leftEye,
    rightEye,
    noseBridge: normalizePoint(
      findFirstValue(payload, [
        'noseBridge',
        'data.noseBridge',
        'nose',
        'data.nose',
        'noseTip',
        'data.noseTip',
      ]),
    ),
    faceBox: normalizeBoundingBox(
      findFirstValue(payload, ['faceBox', 'data.faceBox', 'boundingBox', 'data.boundingBox']),
    ),
    glassesCenter: normalizePoint(
      findFirstValue(payload, ['glassesCenter', 'data.glassesCenter', 'placement.center']),
    ),
    glassesWidth: Number(
      findFirstValue(payload, ['glassesWidth', 'data.glassesWidth', 'placement.width']) ?? 0,
    ),
    glassesHeight: Number(
      findFirstValue(payload, ['glassesHeight', 'data.glassesHeight', 'placement.height']) ?? 0,
    ),
    eyeDistance: Number(
      findFirstValue(payload, ['eyeDistance', 'data.eyeDistance', 'metrics.eyeDistance']) ?? 0,
    ),
    rotationDegrees: Number(
      findFirstValue(payload, [
        'rotationDegrees',
        'data.rotationDegrees',
        'rotation',
        'data.rotation',
      ]) ?? 0,
    ),
    provider,
    model:
      String(
        (findFirstValue(payload, ['model', 'data.model']) ?? defaultModel) ||
          'face-landmarks',
      ).trim() || 'face-landmarks',
  };
};

const buildInternalPayload = (targetImage) => ({
  imageBase64: targetImage.buffer.toString('base64'),
  mimeType: targetImage.mimetype || targetImage.mimeType || 'image/png',
  model: getEnvValue('FACE_LANDMARKS_MODEL', 'mediapipe-face-mesh'),
});

const runPythonScript = async (command, args, payload, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const finish = (handler) => (value) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutId);
      handler(value);
    };

    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);

    const timeoutId = setTimeout(() => {
      child.kill();
      rejectOnce(
        new Error('Internal MediaPipe face landmarks timed out while processing the target image.'),
      );
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      rejectOnce(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolveOnce({ stdout, stderr });
        return;
      }

      const normalizedStdout = stdout.trim();
      const normalizedStderr = stderr.trim();
      let parsedError = '';

      try {
        parsedError = JSON.parse(normalizedStdout)?.error || '';
      } catch (error) {
        parsedError = normalizedStdout;
      }

      rejectOnce(
        new Error(
          parsedError ||
            normalizedStderr ||
            `Internal MediaPipe face landmarks exited with code ${code}.`,
        ),
      );
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
};

const detectWithInternalService = async ({ targetImage }) => {
  const timeoutMs = Number(getEnvValue('TRY_ON_REQUEST_TIMEOUT_MS', '120000'));
  const payload = buildInternalPayload(targetImage);
  const candidates = [
    { command: 'python', args: [mediapipeScriptPath] },
    { command: 'python3', args: [mediapipeScriptPath] },
    { command: 'py', args: ['-3', mediapipeScriptPath] },
  ];

  let lastError = null;

  for (const candidate of candidates) {
    try {
      const result = await runPythonScript(
        candidate.command,
        candidate.args,
        payload,
        timeoutMs,
      );
      const parsedPayload = JSON.parse(result.stdout);

      return normalizeAlignmentPayload(
        parsedPayload,
        'internal',
        getEnvValue('FACE_LANDMARKS_MODEL', 'mediapipe-face-mesh'),
      );
    } catch (error) {
      lastError = error;

      if (!String(error.message || '').toLowerCase().includes('enoent')) {
        break;
      }
    }
  }

  throw new Error(
    lastError?.message ||
      'Internal MediaPipe face landmarks are unavailable on this machine.',
  );
};

const detectWithEndpointService = async ({ targetImage }) => {
  const stageResponse = await requestAiStage({
    stageName: 'Facial Landmarks',
    endpointEnvKey: 'FACE_LANDMARKS_ENDPOINT_URL',
    files: {
      image: targetImage,
    },
    fields: {
      placementType: 'glasses',
    },
  });

  if (stageResponse.type !== 'json') {
    throw new Error('Facial Landmarks returned an unexpected response format.');
  }

  return normalizeAlignmentPayload(
    stageResponse.data,
    'endpoint',
    getEnvValue('FACE_LANDMARKS_MODEL', 'external-endpoint'),
  );
};

export const detectFaceAlignment = async ({ targetImage }) => {
  const provider = getEnvValue('FACE_LANDMARKS_PROVIDER', 'internal').toLowerCase();

  if (provider === 'endpoint') {
    return detectWithEndpointService({ targetImage });
  }

  return detectWithInternalService({ targetImage });
};

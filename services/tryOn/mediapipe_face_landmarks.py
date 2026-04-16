import base64
import io
import json
import math
import sys

import mediapipe as mp
import numpy as np
from PIL import Image


LEFT_EYE_INDICES = [33, 133, 159, 145]
RIGHT_EYE_INDICES = [362, 263, 386, 374]
NOSE_BRIDGE_INDICES = [6, 168]


def decode_image(payload):
    image_base64 = payload.get("imageBase64", "")

    if not image_base64:
      raise ValueError("Facial Landmarks could not read the uploaded target image.")

    image_bytes = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return image


def average_points(indices, landmarks, width, height):
    points = []

    for index in indices:
        landmark = landmarks[index]
        points.append((landmark.x * width, landmark.y * height))

    x = sum(point[0] for point in points) / len(points)
    y = sum(point[1] for point in points) / len(points)

    return {"x": x, "y": y}


def normalize_face_box(landmarks, width, height):
    xs = [landmark.x * width for landmark in landmarks]
    ys = [landmark.y * height for landmark in landmarks]

    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)

    return {
        "x": min_x,
        "y": min_y,
        "width": max_x - min_x,
        "height": max_y - min_y,
    }


def compute_alignment(image):
    width, height = image.size
    image_array = np.array(image)

    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:
        result = face_mesh.process(image_array)

    if not result.multi_face_landmarks:
        raise ValueError("Facial Landmarks could not detect a face in the target image.")

    face_landmarks = result.multi_face_landmarks[0].landmark
    left_eye = average_points(LEFT_EYE_INDICES, face_landmarks, width, height)
    right_eye = average_points(RIGHT_EYE_INDICES, face_landmarks, width, height)
    nose_bridge = average_points(NOSE_BRIDGE_INDICES, face_landmarks, width, height)
    face_box = normalize_face_box(face_landmarks, width, height)

    eye_dx = right_eye["x"] - left_eye["x"]
    eye_dy = right_eye["y"] - left_eye["y"]
    eye_distance = math.hypot(eye_dx, eye_dy)

    if eye_distance <= 0:
        raise ValueError("Facial Landmarks could not calculate a usable eye distance.")

    eye_midpoint = {
        "x": (left_eye["x"] + right_eye["x"]) / 2,
        "y": (left_eye["y"] + right_eye["y"]) / 2,
    }
    glasses_center = {
        "x": (eye_midpoint["x"] * 0.72) + (nose_bridge["x"] * 0.28),
        "y": (eye_midpoint["y"] * 0.76) + (nose_bridge["y"] * 0.24),
    }
    rotation_degrees = math.degrees(math.atan2(eye_dy, eye_dx))

    return {
        "leftEye": left_eye,
        "rightEye": right_eye,
        "noseBridge": nose_bridge,
        "faceBox": face_box,
        "glassesCenter": glasses_center,
        "glassesWidth": eye_distance * 2.2,
        "glassesHeight": eye_distance * 0.82,
        "eyeDistance": eye_distance,
        "rotationDegrees": rotation_degrees,
        "model": "mediapipe-face-mesh",
    }


def main():
    try:
        payload = json.load(sys.stdin)
        image = decode_image(payload)
        result = compute_alignment(image)
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)


if __name__ == "__main__":
    main()

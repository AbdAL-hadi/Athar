import {
  CustomerChatbotError,
  generateCustomerChatbotReply,
} from '../services/customerChatbotService.js';

export const sendCustomerChatbotMessage = async (req, res) => {
  try {
    const message = String(req.body?.message ?? '').trim();
    const page = String(req.body?.page ?? '/').trim() || '/';
    const productContext = req.body?.productContext;

    if (!message) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Please enter a message before sending.',
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Message is too long. Please keep it under 1000 characters.',
      });
    }

    const result = await generateCustomerChatbotReply({
      message,
      page,
      productContext,
    });

    return res.status(200).json({
      status: 'success',
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof CustomerChatbotError) {
      console.error('[CustomerChatbotController] Known chatbot error:', error.message);
      return res.status(error.status).json({
        success: false,
        status: 'error',
        message: error.publicMessage,
      });
    }

    console.error('[CustomerChatbotController] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'The assistant is temporarily unavailable. Please try again in a moment.',
    });
  }
};

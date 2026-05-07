import { Router } from 'express';
import { sendCustomerChatbotMessage } from '../controllers/customerChatbotController.js';

const router = Router();

router.post('/message', sendCustomerChatbotMessage);

export default router;

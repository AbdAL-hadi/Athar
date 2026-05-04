import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import adminAiAssistRoutes from './routes/adminAiAssistRoutes.js';
import adminCommentRoutes from './routes/adminCommentRoutes.js';
import aiTryOnRoutes from './routes/aiTryOnRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import patternStoryRoutes from './routes/patternStoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import tryOnRoutes from './routes/tryOnRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/generated', express.static(path.join(process.cwd(), 'generated')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (_req, res) => {
  res.send('Athar API is running');
});

app.use('/api/admin/ai-assist', adminAiAssistRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/comments', adminCommentRoutes);
app.use('/api/ai', tryOnRoutes);
app.use('/api/ai-try-on', aiTryOnRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/pattern-stories', patternStoryRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

startServer();

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint called');
  res.status(200).json({ status: 'healthy' });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.status(200).json({ message: 'Task Management API is running' });
});

// Tasks endpoints
app.get('/tasks', (req, res) => {
  console.log('Get tasks endpoint called');
  res.status(200).json([
    {
      taskId: '1',
      title: 'Sample Task 1',
      description: 'This is a sample task',
      assignedTo: 'user@example.com',
      deadline: '2025-12-31',
      priority: 'high',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);
});

app.post('/tasks', (req, res) => {
  console.log('Create task endpoint called');
  const task = {
    taskId: uuidv4(),
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  res.status(201).json(task);
});

app.put('/tasks/:taskId', (req, res) => {
  console.log('Update task endpoint called');
  const taskId = req.params.taskId;
  res.status(200).json({
    taskId,
    ...req.body,
    updatedAt: new Date().toISOString()
  });
});

// Start the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment variables:`);
  console.log(`PORT: ${process.env.PORT}`);
  console.log(`AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`TASKS_TABLE: ${process.env.TASKS_TABLE}`);
  console.log(`USER_POOL_ID: ${process.env.USER_POOL_ID}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
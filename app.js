const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const REGION = process.env.AWS_REGION || 'eu-west-1';
const TASKS_TABLE = process.env.TASKS_TABLE || 'Tasks';

// AWS SDK configuration
AWS.config.update({ region: REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Basic endpoints
app.get('/', (req, res) => {
  res.json({ message: 'Task Management API is running' });
});

// Get all tasks
app.get('/tasks', async (req, res) => {
  try {
    const params = {
      TableName: TASKS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    res.json(result.Items || []);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Could not retrieve tasks' });
  }
});

// Create a new task
app.post('/tasks', async (req, res) => {
  try {
    const { title, description, assignedTo, deadline, priority } = req.body;
    
    // Validate required fields
    if (!title || !assignedTo || !deadline) {
      return res.status(400).json({ error: 'Missing required fields: title, assignedTo, deadline' });
    }

    const task = {
      taskId: uuidv4(),
      title,
      description: description || '',
      assignedTo,
      deadline,
      priority: priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin@example.com' // Simplified for now
    };

    await dynamoDB.put({
      TableName: TASKS_TABLE,
      Item: task,
    }).promise();

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Could not create task' });
  }
});

// Update a task
app.put('/tasks/:taskId', async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { status } = req.body;
    
    // Validate required fields
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    // Get the current task
    const getResult = await dynamoDB.get({
      TableName: TASKS_TABLE,
      Key: { taskId },
    }).promise();
    
    if (!getResult.Item) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Update the task
    const updateResult = await dynamoDB.update({
      TableName: TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: 'set #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }).promise();

    res.json(updateResult.Attributes);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Could not update task' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
  console.log(`Environment: REGION=${REGION}, TABLE=${TASKS_TABLE}`);
});
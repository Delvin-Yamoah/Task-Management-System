const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const REGION = process.env.AWS_REGION || 'eu-west-1';
const TASKS_TABLE = process.env.TASKS_TABLE || 'Tasks';
const USER_POOL_ID = process.env.USER_POOL_ID;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

// AWS SDK configuration
AWS.config.update({ region: REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// JWT verification setup
const client = jwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      console.error('Token verification error:', err);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = {
      email: decoded.email,
      groups: decoded['cognito:groups'] || []
    };
    
    next();
  });
};

// Helper function to send email notifications
const sendTaskNotification = async (task, action, recipient) => {
  if (!SENDER_EMAIL) {
    console.log('Sender email not configured, skipping notification');
    return;
  }

  let subject, body;
  
  if (action === 'assigned') {
    subject = `New Task Assigned: ${task.title}`;
    body = `
      <h2>New Task Assigned</h2>
      <p>You have been assigned a new task:</p>
      <p><strong>Title:</strong> ${task.title}</p>
      <p><strong>Description:</strong> ${task.description || 'No description'}</p>
      <p><strong>Priority:</strong> ${task.priority}</p>
      <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
      <p>Please log in to the Task Management System to view more details.</p>
    `;
  } else if (action === 'updated') {
    subject = `Task Updated: ${task.title}`;
    body = `
      <h2>Task Update</h2>
      <p>A task has been updated:</p>
      <p><strong>Title:</strong> ${task.title}</p>
      <p><strong>Status:</strong> ${task.status}</p>
      <p><strong>Priority:</strong> ${task.priority}</p>
      <p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>
      <p>Please log in to the Task Management System to view more details.</p>
    `;
  }

  const params = {
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [recipient]
    },
    Message: {
      Subject: {
        Data: subject
      },
      Body: {
        Html: {
          Data: body
        }
      }
    }
  };

  try {
    await ses.sendEmail(params).promise();
    console.log(`Email notification sent to ${recipient}`);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

// Routes
// Create a new task (Admin only)
app.post('/tasks', authenticate, async (req, res) => {
  try {
    // Check if user is an admin
    if (!req.user.groups.includes('Admins')) {
      return res.status(403).json({ error: 'Only admins can create tasks' });
    }

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
      createdBy: req.user.email
    };

    await dynamoDB.put({
      TableName: TASKS_TABLE,
      Item: task,
    }).promise();

    // Send email notification to the assigned team member
    await sendTaskNotification(task, 'assigned', assignedTo);

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Could not create task' });
  }
});

// Get tasks based on user role
app.get('/tasks', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.groups.includes('Admins');
    let params;
    
    if (isAdmin) {
      // Admins can see all tasks
      params = {
        TableName: TASKS_TABLE,
      };
      
      const result = await dynamoDB.scan(params).promise();
      return res.status(200).json(result.Items);
    } else {
      // Team members can only see their tasks
      params = {
        TableName: TASKS_TABLE,
        IndexName: 'AssignedToIndex',
        KeyConditionExpression: 'assignedTo = :assignedTo',
        ExpressionAttributeValues: {
          ':assignedTo': req.user.email,
        },
      };
      
      const result = await dynamoDB.query(params).promise();
      return res.status(200).json(result.Items);
    }
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Could not retrieve tasks' });
  }
});

// Update task status
app.put('/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const body = req.body;
    const isAdmin = req.user.groups.includes('Admins');
    
    // Get the current task
    const getResult = await dynamoDB.get({
      TableName: TASKS_TABLE,
      Key: { taskId },
    }).promise();
    
    if (!getResult.Item) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = getResult.Item;
    
    // Check permissions
    const isAssignedUser = task.assignedTo === req.user.email;
    
    if (!isAdmin && !isAssignedUser) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }
    
    // Team members can only update status
    if (!isAdmin && Object.keys(body).some(key => key !== 'status')) {
      return res.status(403).json({ error: 'Team members can only update task status' });
    }
    
    // Prepare update expression
    let updateExpression = 'set updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString(),
    };
    
    // Add fields to update
    Object.keys(body).forEach(key => {
      if (key !== 'taskId' && key !== 'createdAt') {
        updateExpression += `, ${key} = :${key}`;
        expressionAttributeValues[`:${key}`] = body[key];
      }
    });
    
    await dynamoDB.update({
      TableName: TASKS_TABLE,
      Key: { taskId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }).promise();
    
    // Get the updated task
    const updatedResult = await dynamoDB.get({
      TableName: TASKS_TABLE,
      Key: { taskId },
    }).promise();
    
    const updatedTask = updatedResult.Item;
    
    // Send email notification about the update
    // Notify the assigned team member if the update was made by admin
    if (isAdmin && req.user.email !== updatedTask.assignedTo) {
      await sendTaskNotification(updatedTask, 'updated', updatedTask.assignedTo);
    }
    
    // Notify the admin who created the task if the update was made by team member
    if (!isAdmin && updatedTask.createdBy) {
      await sendTaskNotification(updatedTask, 'updated', updatedTask.createdBy);
    }
    
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Could not update task' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
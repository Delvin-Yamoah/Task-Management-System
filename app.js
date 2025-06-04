const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const REGION = process.env.AWS_REGION || 'eu-west-1';
const TASKS_TABLE = process.env.TASKS_TABLE || 'Tasks';
const USER_POOL_ID = process.env.USER_POOL_ID || 'eu-west-1_JCjdxsabm';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'yamoahdelvin@gmail.com';

// AWS SDK configuration
AWS.config.update({ region: REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const ses = new AWS.SES();

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

// Send email notification
async function sendEmailNotification(to, subject, body) {
  const params = {
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [to]
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
    console.log(`Email notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}

// Helper function to parse JWT token
function parseJwt(token) {
  if (!token) return {};
  
  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return {};
  }
}

// Get user details from Cognito
async function getUserDetails(email) {
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${email}"`,
      Limit: 1
    };
    
    const result = await cognito.listUsers(params).promise();
    
    if (result.Users && result.Users.length > 0) {
      const user = result.Users[0];
      const nameAttr = user.Attributes.find(attr => attr.Name === 'name');
      
      return {
        username: user.Username,
        email: email,
        name: nameAttr ? nameAttr.Value : email,
        status: user.UserStatus
      };
    }
    
    return { email, name: email };
  } catch (error) {
    console.error('Error getting user details:', error);
    return { email, name: email };
  }
}

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

    // Get creator info from token
    const token = req.headers.authorization;
    const tokenData = parseJwt(token);
    const creatorEmail = tokenData.email || 'admin@example.com';
    
    // Get creator details
    const creator = await getUserDetails(creatorEmail);
    
    // Get assignee details
    const assignee = await getUserDetails(assignedTo);

    const task = {
      taskId: uuidv4(),
      title,
      description: description || '',
      assignedTo,
      assigneeName: assignee.name,
      deadline,
      priority: priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: creatorEmail,
      creatorName: creator.name
    };

    await dynamoDB.put({
      TableName: TASKS_TABLE,
      Item: task,
    }).promise();

    // Send email notification to assignee
    const emailSubject = `New Task Assigned: ${title}`;
    const emailBody = `
      <h2>New Task Assigned</h2>
      <p>You have been assigned a new task by ${creator.name} (${creatorEmail}):</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Description:</strong> ${description || 'No description'}</p>
      <p><strong>Priority:</strong> ${priority || 'medium'}</p>
      <p><strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString()}</p>
      <p>Please log in to the Task Management System to view more details.</p>
    `;
    
    await sendEmailNotification(assignedTo, emailSubject, emailBody);

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
    
    // Get user info from token
    const token = req.headers.authorization;
    const tokenData = parseJwt(token);
    const userEmail = tokenData.email || null;
    
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
    
    const task = getResult.Item;
    
    // Get user details
    const user = await getUserDetails(userEmail);
    
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

    const updatedTask = updateResult.Attributes;
    
    // Send email notification to admin if status changed by team member
    if (userEmail && userEmail === task.assignedTo && task.createdBy) {
      const emailSubject = `Task Status Updated: ${task.title}`;
      const emailBody = `
        <h2>Task Status Updated</h2>
        <p>A task status has been updated by ${user.name} (${userEmail}):</p>
        <p><strong>Title:</strong> ${task.title}</p>
        <p><strong>Previous Status:</strong> ${task.status}</p>
        <p><strong>New Status:</strong> ${status}</p>
        <p><strong>Updated by:</strong> ${user.name} (${userEmail})</p>
        <p>Please log in to the Task Management System to view more details.</p>
      `;
      
      await sendEmailNotification(task.createdBy, emailSubject, emailBody);
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Could not update task' });
  }
});

// Get users (admin only)
app.get('/users', async (req, res) => {
  try {
    // In a real app, verify the token and check if user is admin
    
    const params = {
      UserPoolId: USER_POOL_ID,
      Filter: 'cognito:user_status = "CONFIRMED"',
      Limit: 60
    };
    
    const result = await cognito.listUsers(params).promise();
    
    const users = result.Users.map(user => {
      const emailAttr = user.Attributes.find(attr => attr.Name === 'email');
      const nameAttr = user.Attributes.find(attr => attr.Name === 'name');
      
      return {
        username: user.Username,
        email: emailAttr ? emailAttr.Value : '',
        name: nameAttr ? nameAttr.Value : '',
        status: user.UserStatus
      };
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Could not list users' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
  console.log(`Environment: REGION=${REGION}, TABLE=${TASKS_TABLE}, USER_POOL=${USER_POOL_ID}, SENDER=${SENDER_EMAIL}`);
});
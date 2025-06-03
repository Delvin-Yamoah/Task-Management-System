const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TASKS_TABLE = process.env.TASKS_TABLE;

// Helper function for API responses
const response = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
};

// Import notifications module
const { sendTaskNotification } = require('./notifications');

// Create a new task (Admin only)
exports.createTask = async (event) => {
  try {
    // Get user claims from the event
    const userGroups = event.requestContext.authorizer.claims['cognito:groups'];
    const adminEmail = event.requestContext.authorizer.claims['email'];
    
    // Check if user is an admin
    if (!userGroups || !userGroups.includes('Admins')) {
      return response(403, { error: 'Only admins can create tasks' });
    }

    const body = JSON.parse(event.body);
    const { title, description, assignedTo, deadline, priority } = body;
    
    // Validate required fields
    if (!title || !assignedTo || !deadline) {
      return response(400, { error: 'Missing required fields: title, assignedTo, deadline' });
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
      createdBy: adminEmail
    };

    await dynamoDB.put({
      TableName: TASKS_TABLE,
      Item: task,
    }).promise();

    // Send email notification to the assigned team member
    await sendTaskNotification(task, 'assigned', assignedTo);

    return response(201, task);
  } catch (error) {
    console.error('Error creating task:', error);
    return response(500, { error: 'Could not create task' });
  }
};

// Get tasks based on user role
exports.getTasks = async (event) => {
  try {
    // Get user claims from the event
    const userGroups = event.requestContext.authorizer.claims['cognito:groups'];
    const userId = event.requestContext.authorizer.claims['email'];
    
    let params = {
      TableName: TASKS_TABLE,
    };

    // If user is not an admin, only return their tasks
    if (!userGroups || !userGroups.includes('Admins')) {
      params = {
        TableName: TASKS_TABLE,
        IndexName: 'AssignedToIndex',
        KeyConditionExpression: 'assignedTo = :assignedTo',
        ExpressionAttributeValues: {
          ':assignedTo': userId,
        },
      };
    }

    const result = await dynamoDB.query(params).promise();
    return response(200, result.Items);
  } catch (error) {
    console.error('Error getting tasks:', error);
    return response(500, { error: 'Could not retrieve tasks' });
  }
};

// Update task status (Team members can only update status)
exports.updateTask = async (event) => {
  try {
    const taskId = event.pathParameters.taskId;
    const body = JSON.parse(event.body);
    const userGroups = event.requestContext.authorizer.claims['cognito:groups'];
    const userId = event.requestContext.authorizer.claims['email'];
    
    // Get the current task
    const getResult = await dynamoDB.get({
      TableName: TASKS_TABLE,
      Key: { taskId },
    }).promise();
    
    if (!getResult.Item) {
      return response(404, { error: 'Task not found' });
    }
    
    const task = getResult.Item;
    
    // Check permissions
    const isAdmin = userGroups && userGroups.includes('Admins');
    const isAssignedUser = task.assignedTo === userId;
    
    if (!isAdmin && !isAssignedUser) {
      return response(403, { error: 'Not authorized to update this task' });
    }
    
    // Team members can only update status
    if (!isAdmin && Object.keys(body).some(key => key !== 'status')) {
      return response(403, { error: 'Team members can only update task status' });
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
    if (isAdmin && userId !== updatedTask.assignedTo) {
      await sendTaskNotification(updatedTask, 'updated', updatedTask.assignedTo);
    }
    
    // Notify the admin who created the task if the update was made by team member
    if (!isAdmin && updatedTask.createdBy) {
      await sendTaskNotification(updatedTask, 'updated', updatedTask.createdBy);
    }
    
    return response(200, updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return response(500, { error: 'Could not update task' });
  }
};
const AWS = require('aws-sdk');
const ses = new AWS.SES();

/**
 * Send email notification for task events
 * @param {Object} task - The task object
 * @param {String} eventType - Type of event (assigned, updated)
 * @param {String} recipientEmail - Email of the recipient
 */
exports.sendTaskNotification = async (task, eventType, recipientEmail) => {
  try {
    let subject, message;
    
    switch (eventType) {
      case 'assigned':
        subject = `New Task Assigned: ${task.title}`;
        message = `
          <h2>New Task Assigned</h2>
          <p>You have been assigned a new task:</p>
          <ul>
            <li><strong>Title:</strong> ${task.title}</li>
            <li><strong>Description:</strong> ${task.description || 'No description provided'}</li>
            <li><strong>Priority:</strong> ${task.priority}</li>
            <li><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</li>
          </ul>
          <p>Please log in to the Task Management System to view more details.</p>
        `;
        break;
      
      case 'updated':
        subject = `Task Updated: ${task.title}`;
        message = `
          <h2>Task Status Updated</h2>
          <p>A task has been updated:</p>
          <ul>
            <li><strong>Title:</strong> ${task.title}</li>
            <li><strong>Status:</strong> ${task.status}</li>
            <li><strong>Updated At:</strong> ${new Date(task.updatedAt).toLocaleString()}</li>
          </ul>
          <p>Please log in to the Task Management System to view more details.</p>
        `;
        break;
      
      default:
        throw new Error('Invalid event type');
    }
    
    const params = {
      Source: process.env.SENDER_EMAIL || 'noreply@yourdomain.com',
      Destination: {
        ToAddresses: [recipientEmail]
      },
      Message: {
        Subject: {
          Data: subject
        },
        Body: {
          Html: {
            Data: message
          }
        }
      }
    };
    
    await ses.sendEmail(params).promise();
    console.log(`Email notification sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
};
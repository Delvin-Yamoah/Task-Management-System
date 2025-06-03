const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

/**
 * Lambda function to add new users to the TeamMembers group after confirmation
 */
exports.handler = async (event, context) => {
  // Only run for sign-up events
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const userPoolId = event.userPoolId;
  const username = event.userName;

  try {
    // Add user to TeamMembers group
    await cognito.adminAddUserToGroup({
      GroupName: 'TeamMembers',
      UserPoolId: userPoolId,
      Username: username
    }).promise();
    
    console.log(`User ${username} added to TeamMembers group`);
    return event;
  } catch (error) {
    console.error(`Error adding user to group: ${error}`);
    throw error;
  }
};
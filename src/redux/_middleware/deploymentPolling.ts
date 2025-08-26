import { Middleware, Dispatch }   from '@reduxjs/toolkit';
import { fetchDeploymentStatus }  from '@Actions/deployment';
import {
  createRouteDeployment,
  updateDeploymentStatus
}                                 from '../records/deployment';


// Type for tracking active polling tasks
type PollingTask = {
  environmentId: string;
  routeId: string;
  deploymentId: string;
  timeoutId: NodeJS.Timeout;
};

// Store active polling tasks
const activeTasks: Record<string, PollingTask> = {};

// Helper to create a unique key for each deployment
const getPollingKey = (environmentId: string, routeId: string) => `${environmentId}:${routeId}`;

// Recursive polling function that continues until stopped or deployment completes
const pollDeploymentStatus = async (
  dispatch: Dispatch,
  environmentId: string,
  routeId: string,
  deploymentId: string,
  intervalMs: number = 15000
) => {
  try {
    const key = getPollingKey(environmentId, routeId);

    // Skip if this polling task was cancelled
    if (!activeTasks[key]) return;

    console.log(`Middleware polling deployment ${deploymentId}...`);

    // Call the API to get status
    const response = await fetchDeploymentStatus(deploymentId);
    console.log('Middleware poll response:', response);

    if (response.status !== 'pending') {
      // Deployment is complete or failed, update state and stop polling
      dispatch(updateDeploymentStatus({
        environmentId,
        routeId,
        status: response.status
      }));

      // Clean up this polling task
      if (activeTasks[key]) {
        clearTimeout(activeTasks[key].timeoutId);
        delete activeTasks[key];
      }
      console.log(`Middleware polling stopped for ${key} - status: ${response.status}`);
    } else {
      // Schedule next poll if still pending
      const timeoutId = setTimeout(() => {
        pollDeploymentStatus(dispatch, environmentId, routeId, deploymentId, intervalMs);
      }, intervalMs);

      // Update the timeout ID
      if (activeTasks[key]) {
        activeTasks[key].timeoutId = timeoutId;
      }
    }
  } catch (error) {
    console.error('Error in deployment polling middleware:', error);

    // Handle error, optionally stop polling on error
    const key = getPollingKey(environmentId, routeId);
    if (activeTasks[key]) {
      clearTimeout(activeTasks[key].timeoutId);
      delete activeTasks[key];
    }
    console.log(`Middleware polling stopped for ${environmentId}:${routeId} due to error`);
  }
};

// The actual middleware with simplified type definition
const deploymentPollingMiddleware: Middleware = store => next => action => {
  // Run the original action first
  const result = next(action);

  // Then handle specific actions that should trigger or stop polling
  if (createRouteDeployment.match(action)) {
    const { environmentId, routeId, deployment } = action.payload;
    const { deploymentId } = deployment;

    if (deploymentId) {
      const key = getPollingKey(environmentId, routeId);

      // Cancel any existing polling for this route
      if (activeTasks[key]) {
        clearTimeout(activeTasks[key].timeoutId);
      }

      console.log(`Starting middleware polling for ${key}`);

      // Start a new polling task with a delay
      const timeoutId = setTimeout(() => {
        pollDeploymentStatus(store.dispatch, environmentId, routeId, deploymentId);
      }, 2000); // Short initial delay

      // Track this polling task
      activeTasks[key] = {
        environmentId,
        routeId,
        deploymentId,
        timeoutId
      };
    }
  }

  // (Optional) Handle other actions like explicit stop polling or app shutdown

  return result;
};

export default deploymentPollingMiddleware;

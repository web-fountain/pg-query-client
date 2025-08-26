import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type {
  DeploymentRecord,
  DeploymentEnvironment,
  SetDeploymentRecord,
  CreateRouteDeployment,
  UpdateDeploymentStatus
}                               from './types';

import {
  createAction, createReducer,
  createSelector
}                               from '@reduxjs/toolkit';


// Action Creators
export const setDeploymentRecord    = createAction<SetDeploymentRecord>     ('deployment/setDeploymentRecord');
export const createRouteDeployment  = createAction<CreateRouteDeployment>   ('deployment/createRouteDeployment');
export const updateDeploymentStatus = createAction<UpdateDeploymentStatus>  ('deployment/updateDeploymentStatus');
// Selectors
export const selectDeploymentRecords = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.deploymentRecords
  ],
  (deploymentRecords) => deploymentRecords,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

export const selectRouteDeployment = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.deploymentRecords,
    (state: RootState, environmentId: string, routeId: string) => environmentId,
    (state: RootState, environmentId: string, routeId: string) => routeId
  ],
  (deploymentRecords, environmentId, routeId) => {
    const environmentRecord = deploymentRecords[environmentId];
    if (!environmentRecord) return { isServiceDeploying: false };

    // Access the nested routes map
    const routeDeployment = environmentRecord[routeId];

    // If routeDeployment doesn't exist
    if (!routeDeployment) {
      // Return only the service deploying status if the specific route deployment is missing
      return { isServiceDeploying: environmentRecord.isServiceDeploying };
    }

    // At this point, routeDeployment is guaranteed to be a RouteDeployment object
    return {
      isServiceDeploying: environmentRecord.isServiceDeploying,
      deploymentId      : routeDeployment.deploymentId
    };
  },
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const initialState = {} as DeploymentRecord;
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setDeploymentRecord,
      function(state: DeploymentRecord, action: PayloadAction<SetDeploymentRecord>) {
        const { environmentId, isServiceDeploying, route } = action.payload;
        state[environmentId] = {
          ...state[environmentId],
          isServiceDeploying: isServiceDeploying,
          [route.routeId]: {
            deploymentId: route.deploymentId,
            status      : route.status,
          },
        } as DeploymentEnvironment;
      }
    )
    .addCase(createRouteDeployment,
      function(state: DeploymentRecord, action: PayloadAction<CreateRouteDeployment>) {
        const { environmentId, routeId, deployment } = action.payload;

        state[environmentId] = {
          ...state[environmentId],
          isServiceDeploying: true,
          [routeId]: deployment,
        } as DeploymentEnvironment;
      }
    )
    .addCase(updateDeploymentStatus,
      function(state: DeploymentRecord, action: PayloadAction<UpdateDeploymentStatus>) {
        const { environmentId, routeId, status } = action.payload;
        const environmentRecord = state[environmentId];
        if (!environmentRecord) return;

        const routeDeployment = environmentRecord[routeId];
        if (!routeDeployment) return;

        environmentRecord.isServiceDeploying = false;
        routeDeployment.status = status;
      }
    )
});

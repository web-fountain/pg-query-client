import type { RootState } from '@Redux/store';
import type { Route }     from '@Types/Route';
import type { SaveRoute } from '@Types/RouteRecords';
import type { SavePath }  from '@Types/URLPathRecords';

import { createSelector } from '@reduxjs/toolkit';


const selectUnsavedRoute = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                            => state.operationSpace,
    (state: RootState)                            => state.routeRecords,
    (state: RootState)                            => state.urlPathRecords,
    (state: RootState, routeId: Route['routeId']) => routeId
  ],
  (operationSpace, routeRecords, urlPathRecords, routeId) => {
    const routeRecord = routeRecords[routeId];
    if (!routeRecord) return { isUnsaved: false };

    const urlPathRecord = urlPathRecords[routeRecord.current.urlPathId];
    if (!urlPathRecord) { return console.error('inconsistent state: path must exist', routeRecord)};

    const routeToSave = routeRecord.isUnsaved   ? routeRecord.unsaved              : {};
    const pathToSave  = urlPathRecord.isUnsaved ? { urlPath: urlPathRecord.unsaved }  : {};

    if (Object.keys(routeToSave).length === 0 && Object.keys(pathToSave).length === 0) return { isUnsaved: false };

    const records = {
      operationSpaceId  : operationSpace.operationSpaceId,
      environmentId     : operationSpace.selectedEnvironment.environmentId,
      serviceId         : routeRecord?.current.serviceId,
      routeId           : routeRecord?.current.routeId,
      ...routeToSave,
      ...pathToSave
    } as SaveRoute & SavePath;

    return { isUnsaved: true, unsavedRecords: records };
  }
);


export default selectUnsavedRoute;

import type { Middleware }  from '@reduxjs/toolkit';
import { updateError }      from '@Redux/records/errors';


// Handles Errors
const IGNORE_TYPES = new Set<string>(['errors/report']);

const routeErrorsMiddleware: Middleware = (store) => (next) => (action) => {
  const { type, meta, error, payload={} } = action as any;

  if (typeof type !== 'string'|| IGNORE_TYPES.has(type))
    return next(action as any);
  if (meta && meta._routedError === true)
    return next(action as any);

  if (error === true) {
    const message = meta?.errorInfo?.message || payload.message || 'Validation failed';
    const fields = meta?.errorInfo?.fields || payload.fields;

    store.dispatch(updateError({ actionType: type, message, fields, meta }));
    return action as any;
  }

  return next(action as any);
};


export default routeErrorsMiddleware;

import type { RootState, ReduxDispatch, ReduxStore }  from './store';
import { useDispatch, useSelector, useStore }         from 'react-redux';


type Selector<R, P extends any[] = []> = (state: RootState, ...params: P) => R;

// Use instead of plain `useDispatch` and `useSelector`
const useReduxDispatch  = useDispatch.withTypes<ReduxDispatch>();
const useReduxSelector  = <R, P extends any[] = []>(selector: Selector<R, P>, ...params: P): R => {
  return useSelector.withTypes<RootState>()((state) => selector(state, ...(params as P)));
};
const useReduxStore     = useStore.withTypes<ReduxStore>();


export { useReduxDispatch, useReduxSelector, useReduxStore };

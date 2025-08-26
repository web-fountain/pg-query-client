type RouteDeployment = {
  deploymentId: string;
  status: string;
};

type RouteDeploymentsMap = {
  [routeId: string]: RouteDeployment;
};

export type DeploymentEnvironment = {
  isServiceDeploying: boolean;
} & RouteDeploymentsMap;

export type DeploymentRecord = {
  [environmentId: string]: DeploymentEnvironment;
};

export type SetDeploymentRecord = {
  environmentId: string;
  isServiceDeploying: boolean;
  route: {
    routeId: string;
    deploymentId: string;
    status: string;
  }
};

export type CreateRouteDeployment = {
  environmentId: string;
  routeId: string;
  deployment: RouteDeployment;
};

export type UpdateDeploymentStatus = {
  environmentId: string;
  routeId: string;
  status: string;
};

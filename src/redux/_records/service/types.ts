type Service = {
  serviceId: string;
  serviceName: string;
  serviceDescription?: string;
};

type ServiceRecord = {
  [serviceId: string]: Service;
};


export type { Service, ServiceRecord };

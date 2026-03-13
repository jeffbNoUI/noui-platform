import { fetchAPI, postAPI } from './apiClient';

const CONNECTOR_URL = import.meta.env.VITE_CONNECTOR_URL || '/api';
const INTELLIGENCE_URL = import.meta.env.VITE_INTELLIGENCE_URL || '/api';

// Connector service endpoints
export const connectorAPI = {
  getMember: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}`),
  getEmployment: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/employment`),
  getSalary: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/salary`),
  getAMS: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/salary/ams`),
  getBeneficiaries: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/beneficiaries`),
  getDRO: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/dro`),
  getContributions: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/contributions`),
  getServiceCredit: (id: number) => fetchAPI(`${CONNECTOR_URL}/v1/members/${id}/service-credit`),
};

// Intelligence service endpoints
export const intelligenceAPI = {
  evaluateEligibility: (memberID: number, retirementDate?: string) =>
    postAPI(`${INTELLIGENCE_URL}/v1/eligibility/evaluate`, {
      member_id: memberID,
      retirement_date: retirementDate,
    }),
  calculateBenefit: (memberID: number, retirementDate: string, droId?: number) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/calculate`, {
      member_id: memberID,
      retirement_date: retirementDate,
      ...(droId != null && { dro_id: droId }),
    }),
  calculateOptions: (
    memberID: number,
    retirementDate: string,
    beneficiaryDOB?: string,
    droId?: number,
  ) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/options`, {
      member_id: memberID,
      retirement_date: retirementDate,
      beneficiary_dob: beneficiaryDOB,
      ...(droId != null && { dro_id: droId }),
    }),
  calculateScenario: (memberID: number, retirementDates: string[], droId?: number) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/scenario`, {
      member_id: memberID,
      retirement_dates: retirementDates,
      ...(droId != null && { dro_id: droId }),
    }),
  calculateDRO: (memberID: number, retirementDate: string) =>
    postAPI(`${INTELLIGENCE_URL}/v1/dro/calculate`, {
      member_id: memberID,
      retirement_date: retirementDate,
    }),
};

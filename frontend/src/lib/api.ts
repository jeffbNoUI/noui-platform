const CONNECTOR_URL = import.meta.env.VITE_CONNECTOR_URL || '/api';
const INTELLIGENCE_URL = import.meta.env.VITE_INTELLIGENCE_URL || '/api';

interface APIResponse<T> {
  data: T;
  meta: { request_id: string; timestamp: string };
}

async function fetchAPI<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }
  const body: APIResponse<T> = await res.json();
  return body.data;
}

async function postAPI<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }
  const body: APIResponse<T> = await res.json();
  return body.data;
}

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
  calculateBenefit: (memberID: number, retirementDate: string) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/calculate`, {
      member_id: memberID,
      retirement_date: retirementDate,
    }),
  calculateOptions: (memberID: number, retirementDate: string, beneficiaryDOB?: string) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/options`, {
      member_id: memberID,
      retirement_date: retirementDate,
      beneficiary_dob: beneficiaryDOB,
    }),
  calculateScenario: (memberID: number, retirementDates: string[]) =>
    postAPI(`${INTELLIGENCE_URL}/v1/benefit/scenario`, {
      member_id: memberID,
      retirement_dates: retirementDates,
    }),
  calculateDRO: (memberID: number) =>
    postAPI(`${INTELLIGENCE_URL}/v1/dro/calculate`, {
      member_id: memberID,
    }),
};

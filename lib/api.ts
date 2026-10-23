export interface PredictionResult {
  employee_id: string;
  name: string;
  email: string;
  burnout_score: number;
  risk_level: 'low' | 'medium' | 'high';
  promotion_status: string;
}

export interface DashboardStats {
  total_employees: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  avg_burnout_score: number;
  avg_salary: number;
  patterns_found: number;
  health_score: number;
}

const API_BASE_URL = 'http://localhost:8000';

export async function uploadCSV(file: File): Promise<{ total_employees: number; successful: number; errors: string[] }> {
  console.log(`[uploadCSV] Uploading file: ${file.name}`);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let detail = 'Failed to upload CSV';
      try {
        const errBody = await response.json();
        detail = errBody.detail || detail;
      } catch (_) {}
      console.error(`[uploadCSV] Error ${response.status}:`, detail);
      throw new Error(detail);
    }

    const data = await response.json();
    console.log(`[uploadCSV] Success — ${data.length} records processed:`, data);
    return { total_employees: data.length, successful: data.length, errors: [] };
  } catch (err: any) {
    console.error(`[uploadCSV] Network error:`, err.message);
    throw new Error(`Failed to upload CSV: ${err.message}`);
  }
}

export async function uploadFromGoogleSheets(csvUrl: string): Promise<{ total_employees: number; successful: number; errors: string[] }> {
  console.log(`[uploadFromGoogleSheets] Fetching from URL: ${csvUrl}`);

  try {
    const response = await fetch(`${API_BASE_URL}/predict-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: csvUrl }),
    });

    if (!response.ok) {
      let detail = 'Failed to fetch from Google Sheets';
      try {
        const errBody = await response.json();
        detail = errBody.detail || detail;
      } catch (_) {}
      console.error(`[uploadFromGoogleSheets] Error ${response.status}:`, detail);
      throw new Error(detail);
    }

    const data = await response.json();
    console.log(`[uploadFromGoogleSheets] Success — ${data.length} records processed:`, data);
    return { total_employees: data.length, successful: data.length, errors: [] };
  } catch (err: any) {
    console.error(`[uploadFromGoogleSheets] Network error:`, err.message);
    throw new Error(`Failed to fetch from Google Sheets: ${err.message}`);
  }
}

export async function runPredictions(): Promise<PredictionResult[]> {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Prediction failed');
  }
  return response.json();
}

export async function getResults(): Promise<PredictionResult[]> {
  const response = await fetch(`${API_BASE_URL}/results`);
  if (!response.ok) {
    throw new Error('Failed to fetch results');
  }
  return response.json();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE_URL}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (err) {
    return false;
  }
}

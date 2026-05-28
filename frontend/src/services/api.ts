import jwtManager from "../lib/jwt";

class ApiService {
  private baseURL: string;

  constructor() {
    // Use your backend URL from vercel.json
    this.baseURL = "/api";
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const authHeader = await jwtManager.getAuthHeader();

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          ...options.headers,
        },
      });

      // If token is invalid or expired, try to refresh
      if (response.status === 401) {
        try {
          await jwtManager.refreshAccessToken();
          const newAuthHeader = await jwtManager.getAuthHeader();

          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              "Content-Type": "application/json",
              Authorization: newAuthHeader,
              ...options.headers,
            },
          });

          return retryResponse;
        } catch (_refreshError) {
          // If refresh fails, redirect to login
          jwtManager.clearTokens();
          window.location.href = "/login";
          throw new Error("Authentication required");
        }
      }

      return response;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Example API methods
  async get(endpoint: string): Promise<unknown> {
    const response = await this.makeRequest(endpoint, { method: "GET" });
    return response.json();
  }

  async post(endpoint: string, data: unknown): Promise<unknown> {
    const response = await this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async put(endpoint: string, data: unknown): Promise<unknown> {
    const response = await this.makeRequest(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async delete(endpoint: string): Promise<unknown> {
    const response = await this.makeRequest(endpoint, { method: "DELETE" });
    return response.json();
  }

  // Tenant-specific API methods
  async getTenantData(endpoint: string): Promise<unknown> {
    return this.get(`/tenant${endpoint}`);
  }

  async postTenantData(endpoint: string, data: unknown): Promise<unknown> {
    return this.post(`/tenant${endpoint}`, data);
  }

  // Data Source API methods
  async createDataSource(data: {
    name: string;
    endpoint: string;
    method: string;
    authType: string;
    credentials?: {
      apiKey?: string;
      clientId?: string;
      clientSecret?: string;
      username?: string;
      password?: string;
    };
    headers?: Record<string, string>;
    body?: unknown;
    scopes?: string[];
    permissions?: string[];
    type: string;
  }): Promise<unknown> {
    return this.post("/data-sources", data);
  }

  async testDataSourceConnection(data: {
    endpoint: string;
    method: string;
    authType: string;
    credentials?: {
      apiKey?: string;
      clientId?: string;
      clientSecret?: string;
      username?: string;
      password?: string;
    };
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<unknown> {
    return this.post("/data-sources/test", data);
  }

  async getDataSources(): Promise<unknown> {
    return this.get("/data-sources");
  }

  async deleteDataSource(id: string): Promise<unknown> {
    return this.delete(`/data-sources/${id}`);
  }
}

export default new ApiService();

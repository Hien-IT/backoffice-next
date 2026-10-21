// Ported from directus/app/src/api.ts
// Backoffice (spec 020, Q3 = A): the axios client that app extensions get from `useApi()`. It shares the request
// queue and the requests store of the SDK client (sdk.ts); the base URL is the API URL of config.json, read on each
// request since the SDK is created after this module loads. Only extensions use it (012 FR-001 stays for the app).
import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { useRequestsStore } from '../stores/requests.ts';
import { getApiUrl, requestQueue, sdk } from './sdk.ts';

const api = axios.create({
	withCredentials: true,
});

export type RequestConfig = InternalAxiosRequestConfig & { measureLatency?: boolean };

type InternalRequestConfig = RequestConfig & { id: string; start?: number };
type Response = AxiosResponse & { config: RequestConfig };
export type RequestError = AxiosError & { response: Response };

export const onRequest = (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
	const requestsStore = useRequestsStore();
	const id = requestsStore.startRequest();

	const requestConfig: InternalRequestConfig = {
		...config,
		baseURL: config.baseURL ?? getApiUrl(),
		id,
	};

	return new Promise((resolve) => {
		requestQueue.add(async () => {
			// use getToken to await currently active refreshes
			await sdk.getToken().catch(() => {
				/* fail gracefully */
			});

			if (requestConfig.measureLatency) requestConfig.start = performance.now();

			return resolve(requestConfig);
		});
	});
};

export const onResponse = (response: AxiosResponse | Response): AxiosResponse | Response => {
	onRequestEnd(response);
	return response;
};

export const onError = async (error: RequestError): Promise<RequestError> => {
	onRequestEnd(error.response);
	return Promise.reject(error);
};

api.interceptors.request.use(onRequest);
api.interceptors.response.use(onResponse, onError);

export default api;

function onRequestEnd(response?: AxiosResponse | Response) {
	// Note: Cancelled requests don't respond with the config
	const config = response?.config as InternalRequestConfig | undefined;

	if (config?.id) {
		const requestsStore = useRequestsStore();
		requestsStore.endRequest(config.id);
	}
}

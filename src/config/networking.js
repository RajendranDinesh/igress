import axios from 'axios';

// const BASE_URL = 'https://judge0-ce.p.rapidapi.com/';

const BASE_URL = 'http://10.70.253.127:2358/';

const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10 * 1000,
    withCredentials: true,
});

instance.interceptors.request.use(
    async (response) => {
        return response;
    },
    async (error) => {
        return Promise.reject(error);
    }
);

const SetHeader = (key, value) => {
    instance.defaults.headers.common[key] = value;
};

const RemoveHeader = (key) => {
    delete instance.defaults.headers.common[key];
};

const Request = async (method, url, body, params) => {
    const requestOptions = {
        method,
        url,
        params,
        data: body,
    };

    try {
        const response = await instance.request(requestOptions);
        return response;
    } catch (error) {
        throw error;
    }
};

export { SetHeader, RemoveHeader, Request };

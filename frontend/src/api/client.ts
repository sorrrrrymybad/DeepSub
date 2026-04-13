import axios from 'axios'

export const client = axios.create({ baseURL: '/api' })

client.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error ?? err.message
    return Promise.reject(new Error(message))
  }
)

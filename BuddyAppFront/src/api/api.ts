import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3000', // IP de tu PC
});

export default API;
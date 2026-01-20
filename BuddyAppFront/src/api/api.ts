import axios from 'axios';

const API = axios.create({
  baseURL: 'http://192.168.1.180:3000', // IP de tu PC
});

export default API;
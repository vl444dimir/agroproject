import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App.jsx'
import './styles/global.css'

// Theme config for Ant Design:
const theme = {
  token: {
    colorPrimary: '#1a7c3e',
    colorBgLayout: '#f5f5f5',
    fontFamily: 'Inter, sans-serif',
    borderRadius: 6,
  },
  components: {
    Button: {
      borderRadius: 4, // "no rounded pill shapes" - slightly less rounded for buttons if needed, or stick to 6
    },
    Table: {
      headerBg: '#fafafa',
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)

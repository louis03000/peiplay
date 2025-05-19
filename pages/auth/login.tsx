import dynamic from 'next/dynamic'
export default dynamic(() => import('./login-inner'), { ssr: false }) 
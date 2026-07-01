import { useState } from 'react';
import UploadArea from './components/UploadArea';
import Dashboard from './components/Dashboard';

export default function App() {
  const [data, setData] = useState<any>(null);

  const handleParseSuccess = (parsedData: any) => {
    setData(parsedData);
  };

  const handleReset = () => {
    setData(null);
  };

  return (
    <div className="app-container">
      {data ? (
        <Dashboard data={data} onReset={handleReset} />
      ) : (
        <UploadArea onParseSuccess={handleParseSuccess} />
      )}
    </div>
  );
}

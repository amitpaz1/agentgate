import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import RequestList from './pages/RequestList';
import RequestDetail from './pages/RequestDetail';
import ApiKeys from './pages/ApiKeys';
import Webhooks from './pages/Webhooks';

function App() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AG</span>
              </div>
              <span className="font-semibold text-lg text-gray-900">AgentGate</span>
            </Link>
            <nav className="flex gap-6">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/requests"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Requests
              </Link>
              <Link
                to="/settings/api-keys"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                API Keys
              </Link>
              <Link
                to="/settings/webhooks"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Webhooks
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/requests" element={<RequestList />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/settings/api-keys" element={<ApiKeys />} />
          <Route path="/settings/webhooks" element={<Webhooks />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

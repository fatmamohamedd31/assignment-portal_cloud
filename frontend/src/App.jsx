import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Courses from './pages/Courses.jsx';
import Assignments from './pages/Assignments.jsx';
import AssignmentForm from './pages/AssignmentForm.jsx';
import Notifications from './pages/Notifications.jsx';
import Submit from './pages/Submit.jsx';
import Status from './pages/Status.jsx';
import Result from './pages/Result.jsx';
import Submissions from './pages/Submissions.jsx';
import Grade from './pages/Grade.jsx';
import Reports from './pages/Reports.jsx';
function Nav() {
 const { user, logout } = useAuth();
 const [unread, setUnread] = useState(0);
 const go = useNavigate();
 useEffect(() => {
 if (!user) return;
 const load = () => api('/api/notifications').then((r) => setUnread(r.unread)).catch(() => {});
 load(); const t = setInterval(load, 30000); return () => clearInterval(t);
 }, [user]);
 if (!user) return null;
 return (
 <nav>
 <b style={{ color: '#fff' }}>Assignment Portal</b>
 <Link to="/courses">Courses</Link>
 <Link to="/assignments">Assignments</Link>
 {user.role === 'student' && <Link to="/status">My submissions</Link>}
 {user.role === 'instructor' && <Link to="/reports">Reports</Link>}
 <Link to="/notifications">Notifications {unread > 0 && <span className="badge">{unread}</span>}</Link>
 <span className="spacer" />
 <span style={{ color: '#cbd5e1' }}>{user.fullName} ({user.role})</span>
 <button className="secondary" onClick={() => { logout(); go('/login'); }}>Log out</button>
 </nav>
 );
}
// Redirects to /login when logged out, and to /courses when the role is wrong.
function Guard({ role, children }) {
 const { user, ready } = useAuth();
 if (!ready) return <main>Loading...</main>;
 if (!user) return <Navigate to="/login" replace />;
 if (role && user.role !== role) return <Navigate to="/courses" replace />;
 return children;
}
export default function App() {
 return (
 <>
 <Nav />
 <main>
 <Routes>
 <Route path="/login" element={<Login />} />
 <Route path="/courses" element={<Guard><Courses /></Guard>} />
 <Route path="/assignments" element={<Guard><Assignments /></Guard>} />
 <Route path="/assignments/new" element={<Guard role="instructor"><AssignmentForm /></Guard>} />
 <Route path="/assignments/:id/edit" element={<Guard role="instructor"><AssignmentForm /></Guard>} />
 <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
 <Route path="/submit/:id" element={<Guard role="student"><Submit /></Guard>} />
 <Route path="/status" element={<Guard role="student"><Status /></Guard>} />
 <Route path="/result/:id" element={<Guard role="student"><Result /></Guard>} />
 <Route path="/submissions/:id" element={<Guard role="instructor"><Submissions /></Guard>} />
 <Route path="/grade/:id" element={<Guard role="instructor"><Grade /></Guard>} />
 <Route path="/reports" element={<Guard role="instructor"><Reports /></Guard>} />
 <Route path="*" element={<Navigate to="/courses" replace />} />
 </Routes>
 </main>
 </>
 );
}
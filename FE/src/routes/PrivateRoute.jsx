import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { normalizeRole } from '../utils/auth'

const PrivateRoute = ({ roles }) => {
    const location = useLocation()
    const { isAuthenticated, user, loading } = useAuth()

    if (loading) {
        return <div style={{ padding: 24 }}>Loading...</div>
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (Array.isArray(roles) && roles.length > 0) {
        const normalizedUserRole = normalizeRole(user?.role)
        const normalizedAllowedRoles = roles.map((role) => normalizeRole(role))
        if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
            return <Navigate to="/" replace />
        }
    }

    return <Outlet />
}

export default PrivateRoute

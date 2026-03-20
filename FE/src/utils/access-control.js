const normalizePermission = (permission) => String(permission || '').trim().toLowerCase();

const ROLE_FALLBACKS = {
  owner: [
    'orders_rent.order.list',
    'orders_rent.order.confirm',
    'orders_rent.pickup.complete',
    'orders_rent.return.process',
    'orders_rent.return.finalize',
    'orders_rent.order.finalize',
    'orders_rent.penalty.apply',
    'orders_rent.no_show.mark',
    'orders_rent.washing.complete',
    'inventory.item.read',
    'inventory.item.create',
    'inventory.item.update',
    'inventory.item.update_condition',
    'inventory.item.update_lifecycle',
    'inventory.item.delete',
    'analytics.revenue.read',
    'customers.contact.read_full',
  ],
  manager: [
    'orders_rent.order.list',
    'orders_rent.order.confirm',
    'orders_rent.pickup.complete',
    'orders_rent.return.process',
    'orders_rent.return.finalize',
    'orders_rent.order.finalize',
    'orders_rent.penalty.apply',
    'orders_rent.no_show.mark',
    'orders_rent.washing.complete',
    'inventory.item.read',
    'inventory.item.update',
    'inventory.item.update_condition',
    'inventory.item.update_lifecycle',
    'analytics.revenue.read',
    'customers.contact.read_full',
  ],
  staff: [
    'orders_rent.order.list',
    'orders_rent.order.confirm',
    'orders_rent.pickup.complete',
    'orders_rent.return.process',
    'orders_rent.no_show.mark',
    'orders_rent.washing.complete',
    'inventory.item.read',
    'inventory.item.update',
    'inventory.item.update_condition',
    'inventory.item.update_lifecycle',
    'customers.contact.read_masked',
  ],
};

const normalizePermissions = (user) => {
  if (!user) return new Set();

  const direct = Array.isArray(user.permissions) ? user.permissions : [];
  const nested = Array.isArray(user.access?.permissions) ? user.access.permissions : [];
  const fallback = ROLE_FALLBACKS[String(user.role || '').toLowerCase()] || [];

  return new Set([...fallback, ...direct, ...nested].map(normalizePermission).filter(Boolean));
};

export const can = (user, permission) => {
  const permissions = normalizePermissions(user);
  return permissions.has(normalizePermission(permission));
};

export const canAny = (user, permissions = []) => (
  permissions.some((permission) => can(user, permission))
);

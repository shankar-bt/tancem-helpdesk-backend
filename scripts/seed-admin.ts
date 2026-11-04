import { eq, inArray, not } from 'drizzle-orm';
import { closeDatabase, db } from '../src/config/database';
import { departments, permissions, rolePermissions, roles, ticketMasters, users } from '../src/shared/db/schema';
import { passwordService } from '../src/shared/services/password.service';

const DEPARTMENTS = [
  { name: 'Information Technology', code: 'IT', description: 'IT Infrastructure, Hardware, Network & Software Support' },
  { name: 'Human Resources', code: 'HR', description: 'HR Operations, Payroll, Benefits & Onboarding' },
  { name: 'Finance & Accounts', code: 'FIN', description: 'Finance, Invoicing, Billing & Vendor Claims' },
  { name: 'Plant Operations & Maintenance', code: 'OPS', description: 'Plant Operations, Machinery & Civil Maintenance' },
  { name: 'General Administration', code: 'ADMIN', description: 'Facilities, Logistics, Safety & Office Supplies' },
];

const SUPPORT_CATEGORIES = [
  { type: 'support_category', name: 'Hardware Support', code: 'HW', description: 'Physical equipment, computers, laptops & peripherals' },
  { type: 'support_category', name: 'Software / Application', code: 'SW', description: 'Operating system, business software and tools' },
  { type: 'support_category', name: 'Network & Internet', code: 'NET', description: 'LAN, Wi-Fi, switches, routers, and connectivity' },
  { type: 'support_category', name: 'ERP / SAP System', code: 'ERP', description: 'Enterprise resource planning and SAP accounts' },
  { type: 'support_category', name: 'Email & Communication', code: 'MAIL', description: 'Corporate mailbox, Outlook, and Teams' },
  { type: 'support_category', name: 'Printer / Peripheral', code: 'PRN', description: 'Printers, scanners, and barcode readers' },
];

const ISSUE_CATEGORIES = [
  // Under Hardware Support (HW)
  { type: 'issue_category', name: 'Desktop / Laptop Issue', code: 'HW_PC', parentCode: 'HW', description: 'System hardware and boot problems' },
  { type: 'issue_category', name: 'Monitor & Display', code: 'HW_MON', parentCode: 'HW', description: 'Screen, video cables and resolution problems' },
  { type: 'issue_category', name: 'Power / Battery / UPS', code: 'HW_PWR', parentCode: 'HW', description: 'Battery backup, power supply and adapter' },
  { type: 'issue_category', name: 'Peripheral Devices', code: 'HW_PERIPH', parentCode: 'HW', description: 'Mouse, keyboard, webcam and accessories' },

  // Under Software / Application (SW)
  { type: 'issue_category', name: 'Operating System', code: 'SW_OS', parentCode: 'SW', description: 'Windows/Linux OS errors and updates' },
  { type: 'issue_category', name: 'Office Productivity & Teams', code: 'SW_OFFICE', parentCode: 'SW', description: 'MS Office suite, Word, Excel, Teams' },
  { type: 'issue_category', name: 'Antivirus & Endpoint Security', code: 'SW_AV', parentCode: 'SW', description: 'Antivirus definitions and security warnings' },
  { type: 'issue_category', name: 'Custom Tancem Application', code: 'SW_APP', parentCode: 'SW', description: 'Internal portals and company tools' },

  // Under Network & Internet (NET)
  { type: 'issue_category', name: 'Wi-Fi Connection', code: 'NET_WIFI', parentCode: 'NET', description: 'Wireless LAN and access points' },
  { type: 'issue_category', name: 'Local LAN & Wall Port', code: 'NET_LAN', parentCode: 'NET', description: 'Ethernet cable, port, and IP issues' },
  { type: 'issue_category', name: 'VPN & Remote Access', code: 'NET_VPN', parentCode: 'NET', description: 'VPN client, certificates, and remote tunnel' },
  { type: 'issue_category', name: 'Internet / Proxy Access', code: 'NET_WEB', parentCode: 'NET', description: 'Browsing latency and firewall filtering' },

  // Under ERP / SAP System (ERP)
  { type: 'issue_category', name: 'SAP Account / Session Lock', code: 'ERP_LOGIN', parentCode: 'ERP', description: 'Locked sessions and password reset' },
  { type: 'issue_category', name: 'Purchase & Invoicing Module', code: 'ERP_FIN', parentCode: 'ERP', description: 'Finance, purchase orders, vendor invoices' },
  { type: 'issue_category', name: 'Plant & Production Module', code: 'ERP_PLANT', parentCode: 'ERP', description: 'Plant operations, weighbridge & dispatch' },
  { type: 'issue_category', name: 'Authorization & T-Code Request', code: 'ERP_AUTH', parentCode: 'ERP', description: 'Transaction code privileges and roles' },

  // Under Email & Communication (MAIL)
  { type: 'issue_category', name: 'Outlook Sync & Connection', code: 'MAIL_SYNC', parentCode: 'MAIL', description: 'Mail exchange sync and connection errors' },
  { type: 'issue_category', name: 'Mailbox Storage Quota', code: 'MAIL_QUOTA', parentCode: 'MAIL', description: 'Mailbox size limit and archiving' },
  { type: 'issue_category', name: 'Password Reset & Account Unlock', code: 'MAIL_PASS', parentCode: 'MAIL', description: 'Corporate email credentials and unlock' },
  { type: 'issue_category', name: 'Distribution List & Routing', code: 'MAIL_DL', parentCode: 'MAIL', description: 'Group email lists and delivery failures' },

  // Under Printer / Peripheral (PRN)
  { type: 'issue_category', name: 'Paper Jam & Feeder Failure', code: 'PRN_JAM', parentCode: 'PRN', description: 'Internal jams and paper pickup issues' },
  { type: 'issue_category', name: 'Toner & Cartridge Empty', code: 'PRN_TONER', parentCode: 'PRN', description: 'Consumables replacement and low ink' },
  { type: 'issue_category', name: 'Printer Offline / Spooler', code: 'PRN_OFFLINE', parentCode: 'PRN', description: 'Network printer disconnected or paused' },
  { type: 'issue_category', name: 'Barcode Scanner Issue', code: 'PRN_SCANNER', parentCode: 'PRN', description: 'Industrial scanner malfunction' },
];

const ISSUE_TYPES = [
  // Desktop / Laptop Issue (HW_PC)
  { type: 'issue_type', name: 'System Not Powering On', code: 'HW_PC_NOPWR', parentCode: 'HW_PC', description: 'No lights, no fan, dead device' },
  { type: 'issue_type', name: 'Blue Screen / Sudden Crash', code: 'HW_PC_BSOD', parentCode: 'HW_PC', description: 'BSOD dump and sudden reboots' },
  { type: 'issue_type', name: 'Severe Freezing / Lag', code: 'HW_PC_FREEZE', parentCode: 'HW_PC', description: 'Unresponsive operating system or high CPU/RAM' },

  // Monitor & Display (HW_MON)
  { type: 'issue_type', name: 'Blank / Black Screen', code: 'HW_MON_BLANK', parentCode: 'HW_MON', description: 'No signal to external display' },
  { type: 'issue_type', name: 'Flickering / Lines on Screen', code: 'HW_MON_FLICK', parentCode: 'HW_MON', description: 'Distorted visual artifacts or horizontal lines' },

  // Power / Battery / UPS (HW_PWR)
  { type: 'issue_type', name: 'Laptop Not Charging', code: 'HW_PWR_NOCHG', parentCode: 'HW_PWR', description: 'Plugged in but not charging' },
  { type: 'issue_type', name: 'Power Adapter Damaged', code: 'HW_PWR_ADAPT', parentCode: 'HW_PWR', description: 'Frayed wire or broken pin' },

  // Peripheral Devices (HW_PERIPH)
  { type: 'issue_type', name: 'Keyboard Keys Unresponsive', code: 'HW_PER_KEY', parentCode: 'HW_PERIPH', description: 'Specific or all keys not typing' },
  { type: 'issue_type', name: 'Mouse Disconnected / Malfunction', code: 'HW_PER_MOUSE', parentCode: 'HW_PERIPH', description: 'Cursor jumping or not clicking' },

  // Operating System (SW_OS)
  { type: 'issue_type', name: 'Windows Boot Failure', code: 'SW_OS_BOOT', parentCode: 'SW_OS', description: 'Boot loop or corrupted system files' },
  { type: 'issue_type', name: 'Windows Update Error', code: 'SW_OS_UPD', parentCode: 'SW_OS', description: 'Failed cumulative update patch' },

  // Office Productivity & Teams (SW_OFFICE)
  { type: 'issue_type', name: 'Outlook Crashing on Launch', code: 'SW_OFF_OUT', parentCode: 'SW_OFFICE', description: 'Profile or add-in crash' },
  { type: 'issue_type', name: 'Excel Formula / Macro Error', code: 'SW_OFF_XLS', parentCode: 'SW_OFFICE', description: 'VBA or calculation corruption' },
  { type: 'issue_type', name: 'Teams Audio / Video Glitch', code: 'SW_OFF_TEAM', parentCode: 'SW_OFFICE', description: 'Mic/camera not working in meeting' },

  // Antivirus & Security (SW_AV)
  { type: 'issue_type', name: 'USB Device Blocked by Policy', code: 'SW_AV_USB', parentCode: 'SW_AV', description: 'Pen drive whitelist request' },
  { type: 'issue_type', name: 'Security Threat Warning', code: 'SW_AV_WARN', parentCode: 'SW_AV', description: 'Quarantined file or virus notification' },

  // Custom Tancem Application (SW_APP)
  { type: 'issue_type', name: 'Portal Login Failure', code: 'SW_APP_LOG', parentCode: 'SW_APP', description: 'Invalid token or page error 500' },
  { type: 'issue_type', name: 'Report Generation Timeout', code: 'SW_APP_REP', parentCode: 'SW_APP', description: 'Export to Excel / PDF failing' },

  // Wi-Fi Connection (NET_WIFI)
  { type: 'issue_type', name: 'Cannot Connect to Office Wi-Fi', code: 'NET_WF_NOCONN', parentCode: 'NET_WIFI', description: 'Authentication rejected or IP not assigned' },
  { type: 'issue_type', name: 'Frequent Wi-Fi Dropouts', code: 'NET_WF_DROP', parentCode: 'NET_WIFI', description: 'Intermittent signal disconnection' },

  // Local LAN & Wall Port (NET_LAN)
  { type: 'issue_type', name: 'Network Cable Unplugged Error', code: 'NET_LAN_UNPLG', parentCode: 'NET_LAN', description: 'Ethernet NIC link down' },
  { type: 'issue_type', name: 'IP Address Conflict', code: 'NET_LAN_IPCONF', parentCode: 'NET_LAN', description: 'Duplicate IP on local subnet' },

  // VPN & Remote Access (NET_VPN)
  { type: 'issue_type', name: 'VPN Connection Timed Out', code: 'NET_VPN_TIMEOUT', parentCode: 'NET_VPN', description: 'Gateway unreachable from remote location' },
  { type: 'issue_type', name: 'MFA Push Notification Not Received', code: 'NET_VPN_MFA', parentCode: 'NET_VPN', description: 'Authenticator phone notification delay' },

  // Internet / Proxy Access (NET_WEB)
  { type: 'issue_type', name: 'Official Website Blocked by Firewall', code: 'NET_WEB_BLOCKED', parentCode: 'NET_WEB', description: 'URL category block override needed' },
  { type: 'issue_type', name: 'Extremely Slow Internet Browsing', code: 'NET_WEB_SLOW', parentCode: 'NET_WEB', description: 'Bandwidth choked or proxy unresponsive' },

  // SAP Account / Session Lock (ERP_LOGIN)
  { type: 'issue_type', name: 'User Locked Due to Wrong Password', code: 'ERP_LOG_LOCK', parentCode: 'ERP_LOGIN', description: 'Unlock SAP GUI user' },
  { type: 'issue_type', name: 'Existing Session Stuck in System', code: 'ERP_LOG_TERM', parentCode: 'ERP_LOGIN', description: 'Terminate hung background session' },

  // Purchase & Invoicing Module (ERP_FIN)
  { type: 'issue_type', name: 'PO Approval Workflow Stuck', code: 'ERP_FIN_POST', parentCode: 'ERP_FIN', description: 'Purchase order workflow routing error' },
  { type: 'issue_type', name: 'Tax / GST Ledger Calculation Error', code: 'ERP_FIN_TAX', parentCode: 'ERP_FIN', description: 'Tax mismatch during MIRO/FB60' },

  // Plant & Production Module (ERP_PLANT)
  { type: 'issue_type', name: 'Weighbridge System Sync Failure', code: 'ERP_PLT_WB', parentCode: 'ERP_PLANT', description: 'Gross / tare weight not reflecting in SAP' },
  { type: 'issue_type', name: 'Dispatch Slip Generation Failed', code: 'ERP_PLT_DSP', parentCode: 'ERP_PLANT', description: 'Cement dispatch challan printer error' },

  // Authorization & T-Code Request (ERP_AUTH)
  { type: 'issue_type', name: 'Missing T-Code Authorization', code: 'ERP_AUTH_OBJ', parentCode: 'ERP_AUTH', description: 'SU53 error authorization assignment' },
  { type: 'issue_type', name: 'Plant / Storage Location Access', code: 'ERP_AUTH_CC', parentCode: 'ERP_AUTH', description: 'Access required for Ariyalur / Alangulam' },

  // Outlook Sync & Connection (MAIL_SYNC)
  { type: 'issue_type', name: 'Exchange Server Disconnected', code: 'MAIL_EX_DISC', parentCode: 'MAIL_SYNC', description: 'Outlook showing disconnected status' },
  { type: 'issue_type', name: 'Inbox Emails Not Syncing', code: 'MAIL_EX_MISS', parentCode: 'MAIL_SYNC', description: 'Mail visible on webmail but missing in Outlook' },

  // Mailbox Storage Quota (MAIL_QUOTA)
  { type: 'issue_type', name: 'Mailbox Full (Cannot Send Emails)', code: 'MAIL_QT_FULL', parentCode: 'MAIL_QUOTA', description: 'Quota exceeded 100%' },
  { type: 'issue_type', name: 'Online Archive Activation Request', code: 'MAIL_QT_ARCH', parentCode: 'MAIL_QUOTA', description: 'Enable 50GB online archive' },

  // Password Reset & Account Unlock (MAIL_PASS)
  { type: 'issue_type', name: 'Domain Login Password Reset', code: 'MAIL_PS_RST', parentCode: 'MAIL_PASS', description: 'Windows Active Directory password reset' },
  { type: 'issue_type', name: 'MFA Token Reset for Email', code: 'MAIL_PS_2FA', parentCode: 'MAIL_PASS', description: 'Re-register phone on Microsoft Authenticator' },

  // Distribution List & Routing (MAIL_DL)
  { type: 'issue_type', name: 'Add / Remove User from Email Group', code: 'MAIL_DL_ADD', parentCode: 'MAIL_DL', description: 'Membership modification' },
  { type: 'issue_type', name: 'External Emails Bouncing Back', code: 'MAIL_DL_REJ', parentCode: 'MAIL_DL', description: 'NDR bounce report investigation' },

  // Paper Jam & Feeder Failure (PRN_JAM)
  { type: 'issue_type', name: 'Paper Jammed in Roller', code: 'PRN_JM_ROLL', parentCode: 'PRN_JAM', description: 'Paper accordion in fuser or tray' },
  { type: 'issue_type', name: 'Tray Feed Roller Slipping', code: 'PRN_JM_DUP', parentCode: 'PRN_JAM', description: 'Printer cannot pick up fresh sheets' },

  // Toner & Cartridge Empty (PRN_TONER)
  { type: 'issue_type', name: 'Replace Black Toner Cartridge', code: 'PRN_TN_BLK', parentCode: 'PRN_TONER', description: 'Print density faint, toner low alert' },
  { type: 'issue_type', name: 'Waste Toner Box Full', code: 'PRN_TN_CLR', parentCode: 'PRN_TONER', description: 'Maintenance box replacement warning' },

  // Printer Offline / Spooler (PRN_OFFLINE)
  { type: 'issue_type', name: 'Network Printer Offline in Windows', code: 'PRN_OF_PAUSE', parentCode: 'PRN_OFFLINE', description: 'Device unreachable over LAN' },
  { type: 'issue_type', name: 'Print Spooler Service Stalled', code: 'PRN_OF_SPOOL', parentCode: 'PRN_OFFLINE', description: 'Documents stuck in print queue' },

  // Barcode Scanner Issue (PRN_SCANNER)
  { type: 'issue_type', name: 'Scanner Laser Beam Not Lighting', code: 'PRN_SC_LASER', parentCode: 'PRN_SCANNER', description: 'Trigger pressed but no optical beam' },
  { type: 'issue_type', name: 'Scanner Reading Incorrect Characters', code: 'PRN_SC_DATA', parentCode: 'PRN_SCANNER', description: 'Corrupted baud rate or encoding' },
];

const OTHER_MASTERS = [
  // Office Categories
  { type: 'office_category', name: 'Head Office (Chennai)', code: 'HO', description: 'Corporate Headquarters' },
  { type: 'office_category', name: 'Ariyalur Cement Works', code: 'ACW', description: 'Manufacturing Plant 1' },
  { type: 'office_category', name: 'Alangulam Cement Works', code: 'ALCW', description: 'Manufacturing Plant 2' },
  { type: 'office_category', name: 'Regional Sales Office', code: 'RSO', description: 'Marketing & Distribution' },

  // Mode Types
  { type: 'mode_type', name: 'Web Portal', code: 'WEB', description: 'Online helpdesk portal submission' },
  { type: 'mode_type', name: 'Telephone Call', code: 'PHONE', description: 'Reported via intercom / helpline' },
  { type: 'mode_type', name: 'Email Request', code: 'EMAIL', description: 'Sent to helpdesk@tancem.com' },
  { type: 'mode_type', name: 'Direct Inspection', code: 'WALKIN', description: 'In-person walk-in' },
];

// Granular Page-Action Permissions for Tancem Helpdesk (View, Create, Edit, Delete)
const PERMISSIONS = [
  // Dashboard
  { slug: 'dashboard:view', name: 'View Dashboard', module: 'Dashboard', description: 'Access dashboard analytics and ticket statistics' },

  // Tickets
  { slug: 'tickets:view', name: 'View Tickets', module: 'Tickets', description: 'View own and corporate ticket queues' },
  { slug: 'tickets:create', name: 'Create Tickets', module: 'Tickets', description: 'Raise and submit new support tickets' },
  { slug: 'tickets:edit', name: 'Edit Tickets', module: 'Tickets', description: 'Update status, assign agents and resolve tickets' },
  { slug: 'tickets:delete', name: 'Delete Tickets', module: 'Tickets', description: 'Remove and purge ticket records' },

  // User Management
  { slug: 'users:view', name: 'View Users', module: 'User Management', description: 'View staff directory and user profiles' },
  { slug: 'users:create', name: 'Create Users', module: 'User Management', description: 'Add and register new users' },
  { slug: 'users:edit', name: 'Edit Users', module: 'User Management', description: 'Modify user profiles, roles and departments' },
  { slug: 'users:delete', name: 'Delete Users', module: 'User Management', description: 'Deactivate or delete users' },

  // Category Masters
  { slug: 'masters:view', name: 'View Masters', module: 'Category Masters', description: 'View support categories, issue categories and types' },
  { slug: 'masters:create', name: 'Create Masters', module: 'Category Masters', description: 'Add new category master entries' },
  { slug: 'masters:edit', name: 'Edit Masters', module: 'Category Masters', description: 'Update category master entries' },
  { slug: 'masters:delete', name: 'Delete Masters', module: 'Category Masters', description: 'Delete category master entries' },

  // Departments
  { slug: 'departments:view', name: 'View Departments', module: 'Departments', description: 'View corporate departments list' },
  { slug: 'departments:create', name: 'Create Departments', module: 'Departments', description: 'Add new departments' },
  { slug: 'departments:edit', name: 'Edit Departments', module: 'Departments', description: 'Update department details' },
  { slug: 'departments:delete', name: 'Delete Departments', module: 'Departments', description: 'Delete departments' },

  // Roles & Permissions (Admin only)
  { slug: 'roles:view', name: 'View Roles', module: 'Roles & Permissions', description: 'View RBAC roles and permissions' },
  { slug: 'roles:create', name: 'Create Roles', module: 'Roles & Permissions', description: 'Create new RBAC roles' },
  { slug: 'roles:edit', name: 'Edit Roles', module: 'Roles & Permissions', description: 'Update roles and edit permission matrix' },
  { slug: 'roles:delete', name: 'Delete Roles', module: 'Roles & Permissions', description: 'Delete custom RBAC roles' },
];

const ROLE_DEFINITIONS = [
  {
    name: 'Super Admin',
    slug: 'admin',
    description: 'Full corporate system administrator with all permissions',
    isSystem: true,
    permissions: PERMISSIONS.map((p) => p.slug),
  },
  {
    name: 'Administrator',
    slug: 'administrator',
    description: 'Corporate administrator with full operational management permissions',
    isSystem: true,
    permissions: PERMISSIONS.map((p) => p.slug),
  },
  {
    name: 'Support Agent',
    slug: 'agent',
    description: 'Helpdesk technician resolving tickets and managing support queues',
    isSystem: false,
    permissions: [
      'dashboard:view',
      'tickets:view',
      'tickets:create',
      'tickets:edit',
      'departments:view',
      'masters:view',
    ],
  },
  {
    name: 'Standard User',
    slug: 'user',
    description: 'Corporate employee with basic ticket raising and tracking access',
    isSystem: true,
    permissions: [
      'dashboard:view',
      'tickets:view',
      'tickets:create',
    ],
  },
];

async function seed() {
  console.log('--- 1. Seeding Corporate Departments ---');
  const deptMap = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const [existing] = await db.select().from(departments).where(eq(departments.code, dept.code)).limit(1);
    if (!existing) {
      const [created] = await db.insert(departments).values(dept).returning();
      deptMap.set(dept.code, created.id);
      console.log(`Created department: ${dept.name} (${dept.code})`);
    } else {
      deptMap.set(dept.code, existing.id);
    }
  }

  console.log('\n--- 2. Seeding Hierarchical Ticket Master Categories ---');
  // 2a. Support Categories
  const supportCodeMap = new Map<string, string>();
  for (const item of SUPPORT_CATEGORIES) {
    const [existing] = await db
      .select()
      .from(ticketMasters)
      .where(eq(ticketMasters.name, item.name))
      .limit(1);
    if (!existing) {
      const [created] = await db.insert(ticketMasters).values(item).returning();
      supportCodeMap.set(item.code, created.id);
      console.log(`Created support_category: ${item.name} (${item.code})`);
    } else {
      supportCodeMap.set(item.code, existing.id);
      if (existing.code !== item.code) {
        await db.update(ticketMasters).set({ code: item.code }).where(eq(ticketMasters.id, existing.id));
      }
    }
  }

  // 2b. Issue Categories (linked to Support Category via parentId)
  const issueCatCodeMap = new Map<string, string>();
  for (const item of ISSUE_CATEGORIES) {
    const parentId = supportCodeMap.get(item.parentCode) || null;
    const [existing] = await db
      .select()
      .from(ticketMasters)
      .where(eq(ticketMasters.name, item.name))
      .limit(1);
    if (!existing) {
      const [created] = await db
        .insert(ticketMasters)
        .values({
          type: item.type,
          name: item.name,
          code: item.code,
          description: item.description,
          parentId,
        })
        .returning();
      issueCatCodeMap.set(item.code, created.id);
      console.log(`Created issue_category: ${item.name} -> Parent: ${item.parentCode}`);
    } else {
      issueCatCodeMap.set(item.code, existing.id);
      await db
        .update(ticketMasters)
        .set({ parentId, code: item.code, description: item.description })
        .where(eq(ticketMasters.id, existing.id));
    }
  }

  // 2c. Issue Types (linked to Issue Category via parentId)
  for (const item of ISSUE_TYPES) {
    const parentId = issueCatCodeMap.get(item.parentCode) || null;
    const [existing] = await db
      .select()
      .from(ticketMasters)
      .where(eq(ticketMasters.name, item.name))
      .limit(1);
    if (!existing) {
      await db
        .insert(ticketMasters)
        .values({
          type: item.type,
          name: item.name,
          code: item.code,
          description: item.description,
          parentId,
        })
        .returning();
      console.log(`Created issue_type: ${item.name} -> Parent: ${item.parentCode}`);
    } else {
      await db
        .update(ticketMasters)
        .set({ parentId, code: item.code, description: item.description })
        .where(eq(ticketMasters.id, existing.id));
    }
  }

  // 2d. Office Categories & Mode Types
  for (const item of OTHER_MASTERS) {
    const [existing] = await db
      .select()
      .from(ticketMasters)
      .where(eq(ticketMasters.name, item.name))
      .limit(1);
    if (!existing) {
      await db.insert(ticketMasters).values(item);
      console.log(`Created master [${item.type}]: ${item.name}`);
    }
  }

  console.log('\n--- 3. Seeding Project-Specific Permissions (Tancem Helpdesk) ---');
  const validSlugs = PERMISSIONS.map((p) => p.slug);
  const deletedOld = await db.delete(permissions).where(not(inArray(permissions.slug, validSlugs))).returning();
  if (deletedOld.length > 0) {
    console.log(`Cleaned up ${deletedOld.length} obsolete permissions from other projects`);
  }

  const permMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const [existing] = await db.select().from(permissions).where(eq(permissions.slug, perm.slug)).limit(1);
    if (!existing) {
      const [created] = await db.insert(permissions).values(perm).returning();
      permMap.set(perm.slug, created.id);
      console.log(`Created permission: ${perm.slug}`);
    } else {
      await db.update(permissions).set(perm).where(eq(permissions.id, existing.id));
      permMap.set(perm.slug, existing.id);
    }
  }

  console.log('\n--- 4. Seeding Roles & Mapping Permissions ---');
  const roleMap = new Map<string, string>();
  for (const roleDef of ROLE_DEFINITIONS) {
    let roleId: string;
    const [existing] = await db.select().from(roles).where(eq(roles.slug, roleDef.slug)).limit(1);
    if (!existing) {
      const [created] = await db
        .insert(roles)
        .values({
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
        })
        .returning();
      roleId = created.id;
      console.log(`Created role: ${roleDef.name} (${roleDef.slug})`);
    } else {
      await db
        .update(roles)
        .set({ name: roleDef.name, description: roleDef.description })
        .where(eq(roles.id, existing.id));
      roleId = existing.id;
      console.log(`Updated role: ${roleDef.name} (${roleDef.slug})`);
    }
    roleMap.set(roleDef.slug, roleId);

    // Map permissions
    const requiredPermIds = roleDef.permissions
      .map((slug) => permMap.get(slug))
      .filter(Boolean) as string[];

    if (requiredPermIds.length > 0) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      await db.insert(rolePermissions).values(
        requiredPermIds.map((pId) => ({
          roleId,
          permissionId: pId,
        })),
      );
      console.log(`Assigned ${requiredPermIds.length} permissions to role: ${roleDef.name}`);
    }
  }

  console.log('\n--- 5. Seeding / Updating Super Admin User ---');
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminRoleId = roleMap.get('admin');
  const itDeptId = deptMap.get('IT');

  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!existingAdmin) {
    await db.insert(users).values({
      name: 'System Administrator',
      email: adminEmail,
      role: 'admin',
      roleId: adminRoleId,
      departmentId: itDeptId,
      passwordHash: await passwordService.hash(adminPassword),
    });
    console.log(`Created Super Admin user: ${adminEmail}`);
  } else {
    await db
      .update(users)
      .set({
        roleId: adminRoleId,
        departmentId: itDeptId,
        passwordHash: await passwordService.hash(adminPassword),
      })
      .where(eq(users.id, existingAdmin.id));
    console.log(`Updated Super Admin user: ${adminEmail} with roleId and departmentId`);
  }

  console.log('\nSeeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());

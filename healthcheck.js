// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 5000,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

healthCheck.on('timeout', () => {
  console.error('Health check timeout');
  healthCheck.destroy();
  process.exit(1);
});

healthCheck.end();

---

// scripts/postInstall.js
const fs = require('fs');
const path = require('path');

console.log('🚀 Running post-install setup...');

// Create necessary directories
const directories = [
  'logs',
  'public/uploads',
  'backup',
  'temp'
];

directories.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Create .env file if it doesn't exist
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ Created .env file from .env.example');
  console.log('⚠️  Please update your environment variables in .env file');
}

// Set proper permissions (Unix systems)
if (process.platform !== 'win32') {
  try {
    fs.chmodSync(path.join(process.cwd(), 'logs'), 0o755);
    fs.chmodSync(path.join(process.cwd(), 'public/uploads'), 0o755);
    console.log('✅ Set directory permissions');
  } catch (error) {
    console.log('⚠️  Could not set permissions:', error.message);
  }
}

console.log('✅ Post-install setup completed!');

---

// scripts/seedDatabase.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Role = require('../models/RolesList');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB for seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    // Create admin user
    const adminExists = await User.findOne({ email: 'admin@picme.com' });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await User.create({
        email: 'admin@picme.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        userName: 'admin',
        role: 'admin',
        isCompleted: true,
        location: {
          type: 'Point',
          coordinates: [3.3792, 6.5244] // Lagos, Nigeria
        }
      });
      
      console.log('✅ Admin user created');
    }

    // Create sample creative user
    const creativeExists = await User.findOne({ email: 'creative@picme.com' });
    
    if (!creativeExists) {
      const hashedPassword = await bcrypt.hash('creative123', 12);
      
      await User.create({
        email: 'creative@picme.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Photographer',
        userName: 'johnphoto',
        role: 'creative',
        isCompleted: true,
        bio: 'Professional photographer with 5+ years experience',
        skill: [{
          type: 'photography',
          level: 'expert',
          subsections: [{ section: 'wedding' }, { section: 'portrait' }]
        }],
        pricing: {
          hourly_rate: 15000,
          session_rate: 50000,
          currency: 'NGN'
        },
        location: {
          type: 'Point',
          coordinates: [3.3792, 6.5244]
        }
      });
      
      console.log('✅ Sample creative user created');
    }

    // Create sample client user
    const clientExists = await User.findOne({ email: 'client@picme.com' });
    
    if (!clientExists) {
      const hashedPassword = await bcrypt.hash('client123', 12);
      
      await User.create({
        email: 'client@picme.com',
        password: hashedPassword,
        firstName: 'Jane',
        lastName: 'Client',
        userName: 'janeclient',
        role: 'client',
        isCompleted: true,
        wallet: { balance: 50000 },
        location: {
          type: 'Point',
          coordinates: [3.3792, 6.5244]
        }
      });
      
      console.log('✅ Sample client user created');
    }

  } catch (error) {
    console.error('❌ Error seeding users:', error);
  }
};

const seedRoles = async () => {
  try {
    const roles = [
      {
        name: 'Photography',
        subcategories: [
          { name: 'Wedding Photography' },
          { name: 'Portrait Photography' },
          { name: 'Event Photography' },
          { name: 'Corporate Photography' },
          { name: 'Fashion Photography' },
          { name: 'Product Photography' }
        ]
      },
      {
        name: 'Videography',
        subcategories: [
          { name: 'Wedding Videography' },
          { name: 'Corporate Videos' },
          { name: 'Music Videos' },
          { name: 'Documentary' },
          { name: 'Commercial Videos' }
        ]
      },
      {
        name: 'Editing',
        subcategories: [
          { name: 'Photo Editing' },
          { name: 'Video Editing' },
          { name: 'Color Grading' },
          { name: 'Motion Graphics' }
        ]
      }
    ];

    for (const roleData of roles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (!existingRole) {
        await Role.create(roleData);
        console.log(`✅ Created role: ${roleData.name}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
  }
};

const runSeed = async () => {
  console.log('🌱 Starting database seeding...');
  
  await connectDB();
  await seedUsers();
  await seedRoles();
  
  console.log('✅ Database seeding completed!');
  console.log('\n📋 Test Accounts:');
  console.log('Admin: admin@picme.com / admin123');
  console.log('Creative: creative@picme.com / creative123');
  console.log('Client: client@picme.com / client123');
  
  process.exit(0);
};

// Run if called directly
if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };

---

// scripts/cleanLogs.js
const fs = require('fs');
const path = require('path');

const logDir = path.join(process.cwd(), 'logs');
const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 30;

const cleanOldLogs = () => {
  console.log('🧹 Cleaning old log files...');
  
  if (!fs.existsSync(logDir)) {
    console.log('📁 Log directory does not exist');
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  fs.readdir(logDir, (err, files) => {
    if (err) {
      console.error('❌ Error reading log directory:', err);
      return;
    }

    let deletedCount = 0;
    let totalSize = 0;

    files.forEach(file => {
      const filePath = path.join(logDir, file);
      
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (stats.mtime < cutoffDate) {
          totalSize += stats.size;
          
          fs.unlink(filePath, (err) => {
            if (!err) {
              deletedCount++;
              console.log(`🗑️  Deleted: ${file}`);
            }
          });
        }
      });
    });

    setTimeout(() => {
      console.log(`✅ Cleanup completed: ${deletedCount} files deleted`);
      console.log(`💾 Space freed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    }, 1000);
  });
};

if (require.main === module) {
  cleanOldLogs();
}

module.exports = { cleanOldLogs };

---

// scripts/backupDatabase.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const backupDir = path.join(process.cwd(), 'backup');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupName = `picme-backup-${timestamp}`;

const createBackup = () => {
  console.log('📦 Starting database backup...');

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const mongoUri = process.env.MONGO_URI;
  const backupPath = path.join(backupDir, backupName);

  // Extract database name from URI
  const dbName = mongoUri.split('/').pop().split('?')[0];

  const command = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Backup failed:', error);
      return;
    }

    console.log('✅ Backup completed successfully');
    console.log(`📁 Backup location: ${backupPath}`);

    // Compress backup
    const compressCommand = `tar -czf "${backupPath}.tar.gz" -C "${backupDir}" "${backupName}"`;
    
    exec(compressCommand, (compressError) => {
      if (!compressError) {
        console.log('🗜️  Backup compressed successfully');
        
        // Remove uncompressed backup
        exec(`rm -rf "${backupPath}"`, () => {
          console.log('🧹 Cleaned up temporary files');
        });
      }
    });

    // Clean old backups (keep last 7 days)
    cleanOldBackups();
  });
};

const cleanOldBackups = () => {
  const retentionDays = 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  fs.readdir(backupDir, (err, files) => {
    if (err) return;

    files.forEach(file => {
      if (file.startsWith('picme-backup-') && file.endsWith('.tar.gz')) {
        const filePath = path.join(backupDir, file);
        
        fs.stat(filePath, (err, stats) => {
          if (err) return;

          if (stats.mtime < cutoffDate) {
            fs.unlink(filePath, (err) => {
              if (!err) {
                console.log(`🗑️  Deleted old backup: ${file}`);
              }
            });
          }
        });
      }
    });
  });
};

if (require.main === module) {
  createBackup();
}

module.exports = { createBackup, cleanOldBackups };

---

// scripts/generateDocs.js
const fs = require('fs');
const path = require('path');

const generateApiDocs = () => {
  console.log('📝 Generating API documentation...');

  const endpoints = [
    {
      category: 'Authentication',
      routes: [
        'POST /api/auth/register - Register new user',
        'POST /api/auth/login - User login',
        'POST /api/auth/confirm-otp - Confirm OTP',
        'POST /api/auth/forgot-password - Request password reset',
        'POST /api/auth/reset-password - Reset password',
        'POST /api/auth/logout - User logout'
      ]
    },
    {
      category: 'Users',
      routes: [
        'GET /api/users - Get user profile',
        'PUT /api/users/update - Update profile',
        'PUT /api/users/upload-images - Upload profile/banner images',
        'DELETE /api/users/delete - Delete account'
      ]
    },
    {
      category: 'Bookings',
      routes: [
        'POST /api/bookings/create - Create booking',
        'GET /api/bookings/list - Get user bookings',
        'PUT /api/bookings/update/:id - Update booking',
        'DELETE /api/bookings/cancel/:id - Cancel booking'
      ]
    },
    {
      category: 'Wallet & Payments',
      routes: [
        'POST /api/secure/deposit - Initiate deposit',
        'POST /api/secure/withdraw - Withdraw funds',
        'POST /api/secure/bank - Add bank details',
        'GET /api/secure/balance - Get wallet balance',
        'GET /api/secure/transactions - Get transaction history'
      ]
    }
  ];

  let markdown = '# PIC-ME Backend API Documentation\n\n';
  markdown += 'This is the complete API documentation for the PIC-ME photography booking platform.\n\n';
  markdown += '## Base URL\n';
  markdown += '```\n';
  markdown += 'Development: http://localhost:5000/api\n';
  markdown += 'Production: https://api.picme.com/api\n';
  markdown += '```\n\n';
  markdown += '## Authentication\n';
  markdown += 'Most endpoints require a JWT token in the Authorization header:\n';
  markdown += '```\nAuthorization: Bearer <your-jwt-token>\n```\n\n';

  endpoints.forEach(category => {
    markdown += `## ${category.category}\n\n`;
    category.routes.forEach(route => {
      markdown += `- ${route}\n`;
    });
    markdown += '\n';
  });

  const docsPath = path.join(process.cwd(), 'API_DOCS.md');
  fs.writeFileSync(docsPath, markdown);
  
  console.log('✅ API documentation generated: API_DOCS.md');
};

if (require.main === module) {
  generateApiDocs();
}

module.exports = { generateApiDocs };

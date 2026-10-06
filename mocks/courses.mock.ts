export const mockCourses = [
  // ==================== TRACK 1: ACCESSIBLE ROBOTICS ====================
  {
    title: 'Introduction to Industrial Robotics for Non-Engineers',
    slug: 'intro-industrial-robotics-non-engineers',
    description: 'Demystifying robotics for floor managers, operators, and supervisors who need to understand what robots can do without getting bogged down in math or code.',
    basePrice: 1500000,
    categorySlug: 'accessible-robotics',
    modules: [
      {
        title: 'Module 1: Meet Your Robotic Coworkers',
        order: 1,
        lessons: [
          { title: 'What is an industrial robot? Anatomy & axes of movement', order: 1, duration: 600, isPreview: true },
          { title: 'Key terminology: Payload, reach, repeatability, cycle time', order: 2, duration: 720, isPreview: false },
        ]
      },
      {
        title: 'Module 2: Industrial Safety Regulations',
        order: 2,
        lessons: [
          { title: 'Understanding the factory floor safety layout', order: 1, duration: 800, isPreview: false },
          { title: 'Emergency Stop (E-Stop) protocols and safe operational speeds', order: 2, duration: 500, isPreview: false },
        ]
      },
      {
        title: 'Module 3: End-of-Arm Tooling (EOAT)',
        order: 3,
        lessons: [
          { title: 'How robots interact with the world: Grippers to processing tools', order: 1, duration: 900, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Managing a Robotic Workcell',
        order: 4,
        lessons: [
          { title: 'Daily inspection checklists for operators', order: 1, duration: 450, isPreview: false },
          { title: 'Spotting signs of mechanical wear or calibration drift', order: 2, duration: 650, isPreview: false },
        ]
      }
    ]
  },
  {
    title: 'Collaborative Robots (Cobots) on the Assembly Line',
    slug: 'cobots-assembly-line',
    description: 'Best practices for safely and efficiently integrating robots designed to work side-by-side with human workers without physical safety fencing.',
    basePrice: 1800000,
    categorySlug: 'accessible-robotics',
    modules: [
      {
        title: 'Module 1: The Cobot Revolution vs. Traditional Robotics',
        order: 1,
        lessons: [
          { title: 'What makes a robot "collaborative"? Power and force limiting', order: 1, duration: 700, isPreview: true },
          { title: 'Cost and space benefits of fence-free automation layouts', order: 2, duration: 600, isPreview: false },
        ]
      },
      {
        title: 'Module 2: Risk Assessment for Human-Robot Collaboration',
        order: 2,
        lessons: [
          { title: 'Conducting a task-based safety assessment', order: 1, duration: 950, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Shared Workspace Design',
        order: 3,
        lessons: [
          { title: 'Designing ergonomic workstations for task division', order: 1, duration: 850, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Deploying and Relocating Cobots',
        order: 4,
        lessons: [
          { title: 'Leveraging cobot mobility: Station to station in under an hour', order: 1, duration: 600, isPreview: false },
        ]
      }
    ]
  },

  // ==================== TRACK 2: PRACTICAL FACTORY AUTOMATION ====================
  {
    title: 'Fundamentals of Factory Automation',
    slug: 'fundamentals-factory-automation',
    description: 'A foundational course explaining how an automated line functions, connecting the physical machines to the digital signals controlling them.',
    basePrice: 1200000,
    categorySlug: 'practical-factory-automation',
    modules: [
      {
        title: 'Module 1: Digital and Analog Inputs (Sensors)',
        order: 1,
        lessons: [
          { title: 'How machines "see": Sensors and switches', order: 1, duration: 700, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Making Things Move (Actuators & Pneumatics)',
        order: 2,
        lessons: [
          { title: 'Pneumatic cylinders, valves, compressors, and servo motors', order: 1, duration: 800, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Introduction to the PLC (The Brain)',
        order: 3,
        lessons: [
          { title: 'What is a Programmable Logic Controller?', order: 1, duration: 900, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Reading Automation Diagrams',
        order: 4,
        lessons: [
          { title: 'How to read a basic physical layout and signal travels', order: 1, duration: 650, isPreview: false },
        ]
      }
    ]
  },
  {
    title: 'Designing & Optimizing Automated Workflows',
    slug: 'designing-optimizing-automated-workflows',
    description: 'How to evaluate a manual production line, isolate bottlenecks, and plan a low-cost, high-impact phased automation strategy.',
    basePrice: 1900000,
    categorySlug: 'practical-factory-automation',
    modules: [
      {
        title: 'Module 1: Value Stream Mapping for Automation',
        order: 1,
        lessons: [
          { title: 'Mapping current manual process and calculating Cycle/Takt Time', order: 1, duration: 800, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Identifying "Automation-Ready" Tasks',
        order: 2,
        lessons: [
          { title: 'The 3Ds rule: Dull, Dirty, or Dangerous', order: 1, duration: 600, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Phased Implementation Strategy',
        order: 3,
        lessons: [
          { title: 'Designing a modular, step-by-step transition plan', order: 1, duration: 750, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Lean Automation Principles',
        order: 4,
        lessons: [
          { title: 'Eliminating waste before adding machines', order: 1, duration: 700, isPreview: false },
        ]
      }
    ]
  },
  {
    title: 'First-Response Maintenance for Automated Systems',
    slug: 'first-response-maintenance',
    description: 'Empowering line operators to diagnose and fix 80% of common automation glitches, drastically cutting down on external technician costs.',
    basePrice: 1600000,
    categorySlug: 'practical-factory-automation',
    modules: [
      {
        title: 'Module 1: The First-Response Mindset',
        order: 1,
        lessons: [
          { title: 'Triaging an error: Mechanical, electrical, and software', order: 1, duration: 600, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Troubleshooting Sensors and Pnuematics',
        order: 2,
        lessons: [
          { title: 'Fixing the most common issues on the line', order: 1, duration: 1200, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Reading HMI Fault Codes',
        order: 3,
        lessons: [
          { title: 'Navigating Human-Machine Interfaces (HMIs) to read logs', order: 1, duration: 850, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Safe Interventions & Reset Protocols',
        order: 4,
        lessons: [
          { title: 'Lockout/Tagout (LOTO) and safe restart sequences', order: 1, duration: 900, isPreview: false },
        ]
      }
    ]
  },

  // ==================== TRACK 3: APPLIED AI & SMART MANUFACTURING ====================
  {
    title: 'Applied AI & Machine Vision in Quality Control',
    slug: 'applied-ai-machine-vision-quality-control',
    description: 'How to use modern smart cameras and AI models to automate inspections, eliminate human sorting errors, and ensure defect-free shipping.',
    basePrice: 2200000,
    categorySlug: 'applied-ai-smart-manufacturing',
    modules: [
      {
        title: 'Module 1: Hardware Setup for Machine Vision',
        order: 1,
        lessons: [
          { title: 'Choosing cameras, lenses, and lighting configurations', order: 1, duration: 750, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Rule-Based Vision vs. AI Inspection',
        order: 2,
        lessons: [
          { title: 'Traditional vision vs. Deep Learning AI', order: 1, duration: 850, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Training an Object Detection Model (No-Code)',
        order: 3,
        lessons: [
          { title: 'Collecting images, labeling defects, and training custom models', order: 1, duration: 1100, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Inline Integration & Sorting Gates',
        order: 4,
        lessons: [
          { title: 'Connecting the camera to physical rejection mechanisms', order: 1, duration: 650, isPreview: false },
        ]
      }
    ]
  },
  {
    title: 'Predictive Maintenance Fundamentals',
    slug: 'predictive-maintenance-fundamentals',
    description: 'Transitioning from reactive "break-fix" cycles to data-driven uptime by using smart sensors to predict equipment failures weeks in advance.',
    basePrice: 2500000,
    categorySlug: 'applied-ai-smart-manufacturing',
    modules: [
      {
        title: 'Module 1: The Cost of Unplanned Downtime',
        order: 1,
        lessons: [
          { title: 'Understanding the failure curve (P-F Curve)', order: 1, duration: 600, isPreview: true },
        ]
      },
      {
        title: 'Module 2: IoT Sensors for Condition Monitoring',
        order: 2,
        lessons: [
          { title: 'Deploying wireless sensors: vibration, temperature, acoustic', order: 1, duration: 800, isPreview: false },
        ]
      },
      {
        title: 'Module 3: AI Anomaly Detection',
        order: 3,
        lessons: [
          { title: 'How ML learns the "normal pulse" of a machine', order: 1, duration: 900, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Scheduling Smart Maintenance Work Orders',
        order: 4,
        lessons: [
          { title: 'Planning maintenance windows during natural production breaks', order: 1, duration: 700, isPreview: false },
        ]
      }
    ]
  },
  {
    title: 'The Smart Factory (Industry 4.0) Roadmap',
    slug: 'smart-factory-roadmap',
    description: 'A strategic guide for management and IT leads on how to break operational silos and connect individual machines into a centralized data ecosystem.',
    basePrice: 3000000,
    categorySlug: 'applied-ai-smart-manufacturing',
    modules: [
      {
        title: 'Module 1: The Layers of a Smart Factory',
        order: 1,
        lessons: [
          { title: 'Sensors to SCADA, MES, and ERP', order: 1, duration: 850, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Legacy Equipment Modernization (Retrofitting)',
        order: 2,
        lessons: [
          { title: 'Bringing older machines into the internet age', order: 1, duration: 750, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Unified Dashboards & OEE Tracking',
        order: 3,
        lessons: [
          { title: 'Tracking Overall Equipment Effectiveness (OEE) digitally', order: 1, duration: 650, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Cybersecurity Essentials for Manufacturing',
        order: 4,
        lessons: [
          { title: 'Protecting operational technology (OT) from external threats', order: 1, duration: 1000, isPreview: false },
        ]
      }
    ]
  },

  // ==================== TRACK 4: BUSINESS STRATEGY & ROI ====================
  {
    title: 'Automation Investment & ROI Optimization',
    slug: 'automation-investment-roi-optimization',
    description: 'A clear, non-technical financial guide for manufacturing executives to build bulletproof business cases for automation technology.',
    basePrice: 3500000,
    categorySlug: 'business-strategy-roi',
    modules: [
      {
        title: 'Module 1: The Total Cost of Ownership (TCO)',
        order: 1,
        lessons: [
          { title: 'Accounting for hidden costs in automation', order: 1, duration: 700, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Calculating ROI and Payback Periods',
        order: 2,
        lessons: [
          { title: 'Step-by-step formulas for financial returns', order: 1, duration: 850, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Capital Expenditure vs. Operational Expenditure',
        order: 3,
        lessons: [
          { title: 'Traditional purchases vs. Robots-as-a-Service (RaaS)', order: 1, duration: 650, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Risk Mitigation in Automation Procurement',
        order: 4,
        lessons: [
          { title: 'Scoping projects, PoC phases, and writing bulletproof contracts', order: 1, duration: 900, isPreview: false },
        ]
      }
    ]
  },
  {
    title: 'Leading the Workforce Transition',
    slug: 'leading-workforce-transition',
    description: 'Managing the human side of industrial transformation—how to prevent worker resistance, boost morale, and smoothly upskill staff.',
    basePrice: 2800000,
    categorySlug: 'business-strategy-roi',
    modules: [
      {
        title: 'Module 1: Combating "Robot Anxiety"',
        order: 1,
        lessons: [
          { title: 'Transparent communication strategies for management', order: 1, duration: 700, isPreview: true },
        ]
      },
      {
        title: 'Module 2: Designing an Internal Upskilling Framework',
        order: 2,
        lessons: [
          { title: 'Identifying staff for retraining into robot operators', order: 1, duration: 800, isPreview: false },
        ]
      },
      {
        title: 'Module 3: Incentives and Change Management',
        order: 3,
        lessons: [
          { title: 'Aligning performance metrics with new technical responsibilities', order: 1, duration: 650, isPreview: false },
        ]
      },
      {
        title: 'Module 4: Case Studies in Successful Transformation',
        order: 4,
        lessons: [
          { title: 'Analysis of real-world factories that scaled production', order: 1, duration: 1100, isPreview: false },
        ]
      }
    ]
  }
];
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Contact = require('../models/Contact');

const rateLimitStore = new Map();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, subject, message, captchaAnswer, captchaExpected, formStartTime, website } = req.body;

    if (!name || !subject || !message) {
      return res.status(400).json({ message: 'Name, subject, and message are required' });
    }

    if (!captchaAnswer || parseInt(captchaAnswer) !== captchaExpected) {
      return res.status(400).json({ message: 'Invalid security check answer' });
    }

    if (website && website.trim() !== '') {
      return res.status(400).json({ message: 'Spam detected' });
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const rateLimitKey = `rate_${clientIP}`;
    
    if (rateLimitStore.has(rateLimitKey)) {
      const lastSubmission = rateLimitStore.get(rateLimitKey);
      if (now - lastSubmission < 30000) {
        return res.status(429).json({ message: 'Please wait before submitting again' });
      }
    }
    rateLimitStore.set(rateLimitKey, now);

    if (formStartTime && (now - formStartTime < 3000)) {
      return res.status(400).json({ message: 'Form submitted too quickly' });
    }

    const content = `${name} ${subject} ${message}`.toLowerCase();
    const suspiciousPatterns = [
      /https?:\/\//gi,
      /\b(viagra|casino|lottery|winner|congratulations|claim|prize|free money|earn money|work from home)\b/gi,
      /(.)\1{10,}/,
      /<[^>]*>/g,
      /\b[A-Z]{5,}\b/g
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(content))) {
      return res.status(400).json({ message: 'Message contains suspicious content' });
    }

    if (name.length > 100 || subject.length > 200 || message.length > 2000) {
      return res.status(400).json({ message: 'Input exceeds maximum length' });
    }

    if (message.split(' ').length < 3) {
      return res.status(400).json({ message: 'Message is too short' });
    }
    
    const contact = new Contact({
      name: name.trim(),
      email: '',
      subject: subject.trim(),
      message: message.trim(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      submissionTime: new Date(),
      formDuration: formStartTime ? now - formStartTime : 0
    });
    
    await contact.save();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Your email address
      subject: `Portfolio Contact: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #344e41; border-bottom: 2px solid #588157; padding-bottom: 10px;">New Contact Form Submission</h2>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #3a5a40; margin-bottom: 10px;">Contact Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #344e41; border-bottom: 1px solid #eee;">Name:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #344e41; border-bottom: 1px solid #eee;">Subject:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${subject}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #344e41; border-bottom: 1px solid #eee;">Form Duration:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${Math.round((formStartTime ? now - formStartTime : 0) / 1000)}s</td>
              </tr>
            </table>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #3a5a40; margin-bottom: 10px;">Message:</h3>
            <div style="background-color: #f8f7f5; padding: 15px; border-radius: 5px; border-left: 4px solid #588157;">
              <p style="margin: 0; line-height: 1.6; color: #344e41;">${message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
          
          <div style="margin: 20px 0; font-size: 12px; color: #666;">
            <h4 style="color: #3a5a40; margin-bottom: 5px;">Security Information:</h4>
            <p>IP Address: ${req.ip || req.connection.remoteAddress}</p>
            <p>User Agent: ${req.get('User-Agent') || 'Unknown'}</p>
            <p>Submission Time: ${new Date().toLocaleString()}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666; text-align: center; margin: 10px 0;">
            <em>Sent from your portfolio website with spam protection active</em>
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    res.status(201).json({ 
      message: 'Message sent successfully! I\'ll get back to you soon.',
      id: contact._id
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Failed to send message. Please try again.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    let query = {};
    
    if (status) query.status = status;
    
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Contact.countDocuments(query);
    
    res.json({
      contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalContacts: total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [key, timestamp] of rateLimitStore.entries()) {
    if (timestamp < oneHourAgo) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

module.exports = router;

#!/usr/bin/env node

/**
 * Generate test contacts CSV for Odoo import
 * Usage: node scripts/generate-test-contacts.js > test_contacts.csv
 */

const COUNT = 100;

// CSV Header - Match Odoo's exact template format
console.log('Name,Company Type,Related Company,Email,Phone,Street,Street2,City,State,Zip,Country,Tax ID,Website,Tags,Reference,Notes');

// Generate contacts
for (let i = 1; i <= COUNT; i++) {
  const name = `Test Contact ${i}`;
  const companyType = 'Person'; // Required: "Person" or "Company"
  const relatedCompany = `Test Company ${Math.ceil(i / 10)}`; // 10 contacts per company
  const email = `contact${i}@testcorp.com`;
  const phone = `+1-555-${String(i).padStart(4, '0')}`;
  const street = `${i * 10} Main Street`;
  const street2 = i % 3 === 0 ? `Suite ${i}` : '';
  const city = ['New York', 'Los Angeles', 'Chicago', 'Houston'][i % 4];
  const state = ['NY', 'CA', 'IL', 'TX'][i % 4];
  const zip = String(10000 + i).padStart(5, '0');
  const country = 'United States';
  const taxId = `TAX-${String(i).padStart(6, '0')}`;
  const website = `https://testcorp${Math.ceil(i / 10)}.com`;
  const tags = i % 3 === 0 ? 'VIP' : i % 2 === 0 ? 'Lead' : 'Customer';
  const reference = `REF-${String(i).padStart(4, '0')}`;
  const notes = `Test contact ${i} - Generated for pagination testing`;

  console.log(`"${name}","${companyType}","${relatedCompany}","${email}","${phone}","${street}","${street2}","${city}","${state}","${zip}","${country}","${taxId}","${website}","${tags}","${reference}","${notes}"`);
}

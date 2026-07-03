// Application State Memory
let productsArray = [];
let bomsList = [];
let partsMap = {};
let suppliersMap = {};
let partSuppliersList = [];

// Universal CSV Parsing Engine
function parseCSV(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        let obj = {};
        headers.forEach((header, i) => { obj[header] = values[i] || ''; });
        return obj;
    });
}

// Bootstrapping: Fetching Data Streams
window.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('effectivity-date').value = today;

    Promise.all([
        fetch('Product.csv').then(res => res.text()),
        fetch('BOM.csv').then(res => res.text()),
        fetch('Part.csv').then(res => res.text()),
        fetch('Supplier.csv').then(res => res.text()),
        fetch('Part_Supplier.csv').then(res => res.text())
    ])
    .then(([prodText, bomText, partText, suppText, bridgeText]) => {
        productsArray = parseCSV(prodText);
        bomsList = parseCSV(bomText);
        const rawParts = parseCSV(partText);
        const rawSuppliers = parseCSV(suppText);
        partSuppliersList = parseCSV(bridgeText);

        rawParts.forEach(p => partsMap[p.part_id] = p);
        rawSuppliers.forEach(s => suppliersMap[s.supplier_id] = s);

        initializeInterface();
    });
});

function initializeInterface() {
    const prodDropdown = document.getElementById('product-select');
    prodDropdown.innerHTML = '<option value="">-- Choose Finished Product --</option>';
    productsArray.forEach(prod => {
        prodDropdown.innerHTML += `<option value="${prod.product_id}">${prod.product_id} - ${prod.name}</option>`;
    });
    prodDropdown.addEventListener('change', () => { closeSidebar(); calculateBOMSnapshot(); });
    document.getElementById('effectivity-date').addEventListener('change', () => { closeSidebar(); calculateBOMSnapshot(); });
}

// Core Engineering Processing Engine
function calculateBOMSnapshot() {
    const targetProductId = document.getElementById('product-select').value;
    const targetDateStr = document.getElementById('effectivity-date').value;
    const tbody = document.getElementById('bom-table-body');

    if (!targetProductId || !targetDateStr) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Configure filters above to construct build requirements.</td></tr>';
        return;
    }

    const targetTime = new Date(targetDateStr).getTime();
    const activeBOMEntries = bomsList.filter(entry => {
        if (entry.product_id !== targetProductId) return false;
        const validFromTime = new Date(entry.effective_from).getTime();
        const validToTime = entry.effective_to ? new Date(entry.effective_to).getTime() : new Date('9999-12-31').getTime();
        return targetTime >= validFromTime && targetTime <= validToTime;
    });

    if (activeBOMEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No operational components found.</td></tr>';
        return;
    }

    let html = '';
    activeBOMEntries.forEach(bomLine => {
        const partInfo = partsMap[bomLine.part_id] || { name: 'Unknown Asset', type: 'Unclassified', stock: '0' };
        const supplierCount = partSuppliersList.filter(link => link.part_id === bomLine.part_id).length;

        const actionButton = supplierCount > 0 
            ? `<button class="view-suppliers-btn" onclick="openSidebar('${bomLine.part_id}')">Show Suppliers (${supplierCount})</button>`
            : `<span style="color:#999; font-style:italic; font-size:13px;">No Suppliers</span>`;

        html += `
            <tr>
                <td><strong>${bomLine.part_id}</strong></td>
                <td>${partInfo.name}</td>
                <td>${partInfo.type}</td>
                <td>${bomLine.quantity}</td>
                <td>${partInfo.stock}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Procurement Interface Panel Logic
function openSidebar(partId) {
    const drawer = document.getElementById('supplier-drawer');
    const partInfo = partsMap[partId] || { name: 'Unknown Part' };
    
    document.getElementById('sidebar-part-name').textContent = partInfo.name;
    document.getElementById('sidebar-part-id').textContent = `Part ID: ${partId}`;

    const vendors = partSuppliersList.filter(link => link.part_id === partId);
    vendors.sort((a, b) => a.preferred_order - b.preferred_order);

    let sidebarHTML = '';
    vendors.forEach(v => {
        const vendorDetails = suppliersMap[v.supplier_id] || { supplier_name: 'Unknown Supplier', contact_email: 'N/A', lead_time: 'N/A' };
        const badge = v.preferred_order === '1' ? `<span class="preferred-badge">Primary</span>` : '';

        sidebarHTML += `
            <div class="vendor-card">
                <div class="vendor-title">${badge}${vendorDetails.supplier_name}</div>
                <div style="font-size: 13px; margin-top:5px; color:#555;">
                    <strong>Price:</strong> $${v.price}<br>
                    <strong>Lead Time:</strong> ${vendorDetails.lead_time} days<br>
                    <strong>Contact:</strong> <a href="mailto:${vendorDetails.contact_email}" style="color:#007acc;">${vendorDetails.contact_email}</a><br>
                    <span style="color:#888; font-size:11px;">System Rank Priority: ${v.preferred_order}</span>
                </div>
            </div>
        `;
    });

    document.getElementById('sidebar-content').innerHTML = sidebarHTML;
    drawer.style.display = 'block';
}

function closeSidebar() {
    document.getElementById('supplier-drawer').style.display = 'none';
}
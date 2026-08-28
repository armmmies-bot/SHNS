/**
 * Google Apps Script for Sangkhlaburi Hospital Nurse Scheduling App (Ultra-Fast & High-Performance)
 * Sheet URL: https://docs.google.com/spreadsheets/d/1zr9Qtek4BK24wZg1hWh0s0Ui9WGtcP7H3GNJ8ba5kwQ/edit?usp=sharing
 */

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    ensureTabsExist(sheet);

    if (e && e.parameter && e.parameter.action === 'clear_all') {
      clearAllDatabaseData();
      var clearRes = JSON.stringify({ status: 'success', message: 'All data cleared successfully' });
      if (e.parameter.callback) {
        return ContentService.createTextOutput(e.parameter.callback + '(' + clearRes + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(clearRes).setMimeType(ContentService.MimeType.JSON);
    }

    var staffData = readSheetData(sheet.getSheetByName('Staff'));
    var scheduleSheet = sheet.getSheetByName('Schedule');
    var scheduleData = readScheduleData(scheduleSheet);
    var swapRequestsData = readSheetData(sheet.getSheetByName('SwapRequests'));

    var response = {
      status: 'success',
      staff: staffData,
      schedule: scheduleData,
      swapRequests: swapRequestsData
    };

    var jsonString = JSON.stringify(response);

    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + jsonString + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorResponse = JSON.stringify({ status: 'error', message: err.toString() });
    return ContentService.createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var contents = "";
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && e.parameter.payload) {
      contents = e.parameter.payload;
    }

    var data = JSON.parse(contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    ensureTabsExist(sheet);

    var action = data.action;

    if (action === 'clear_all') {
      clearAllDatabaseData();
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'All data cleared' }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'save_all' || action === 'init') {
      if (data.staff) saveStaffData(sheet.getSheetByName('Staff'), data.staff);
      if (data.schedule) saveScheduleData(sheet.getSheetByName('Schedule'), data.schedule);
      if (data.swapRequests) saveSwapRequestsData(sheet.getSheetByName('SwapRequests'), data.swapRequests);
    } else if (action === 'update_schedule') {
      if (data.schedule) saveScheduleData(sheet.getSheetByName('Schedule'), data.schedule);
    } else if (action === 'update_swap_requests') {
      if (data.swapRequests) saveSwapRequestsData(sheet.getSheetByName('SwapRequests'), data.swapRequests);
    } else if (action === 'update_staff') {
      if (data.staff) saveStaffData(sheet.getSheetByName('Staff'), data.staff);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', action: action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function clearAllDatabaseData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  ensureTabsExist(sheet);
  
  var staffSheet = sheet.getSheetByName('Staff');
  if (staffSheet) {
    staffSheet.clearContents();
    staffSheet.getRange(1, 1, 1, 5).setValues([['id', 'name', 'role', 'password', 'avatar']]);
  }

  var scheduleSheet = sheet.getSheetByName('Schedule');
  if (scheduleSheet) {
    scheduleSheet.clearContents();
    scheduleSheet.getRange(1, 1, 1, 4).setValues([['staffId', 'staffName', 'scheduleJson', 'updatedAt']]);
  }

  var swapSheet = sheet.getSheetByName('SwapRequests');
  if (swapSheet) {
    swapSheet.clearContents();
    swapSheet.getRange(1, 1, 1, 13).setValues([['id', 'requesterId', 'requesterName', 'partnerId', 'partnerName', 'room', 'myDay', 'myShift', 'targetDay', 'targetShift', 'status', 'createdAt', 'reviewedBy']]);
  }

  return { status: 'success', message: 'All sheets cleared' };
}

function ensureTabsExist(spreadsheet) {
  var requiredTabs = ['Staff', 'Schedule', 'SwapRequests'];
  requiredTabs.forEach(function (tabName) {
    var sheet = spreadsheet.getSheetByName(tabName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(tabName);
      if (tabName === 'Staff') {
        sheet.appendRow(['id', 'name', 'role', 'password', 'avatar']);
      } else if (tabName === 'Schedule') {
        sheet.appendRow(['staffId', 'staffName', 'scheduleJson', 'updatedAt']);
      } else if (tabName === 'SwapRequests') {
        sheet.appendRow(['id', 'requesterId', 'requesterName', 'partnerId', 'partnerName', 'room', 'myDay', 'myShift', 'targetDay', 'targetShift', 'status', 'createdAt', 'reviewedBy']);
      }
    }
  });
}

function readSheetData(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var isEmpty = true;
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      if (val !== "") isEmpty = false;
      obj[headers[j]] = val;
    }
    if (!isEmpty) {
      result.push(obj);
    }
  }
  return result;
}

function readScheduleData(sheet) {
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return {};

  var headers = data[0];
  var scheduleObj = {};

  // Check if format is compact JSON format (staffId, staffName, scheduleJson)
  var isJsonFormat = headers.indexOf('scheduleJson') !== -1;

  if (isJsonFormat) {
    var sIdIdx = headers.indexOf('staffId');
    var jsonIdx = headers.indexOf('scheduleJson');
    for (var i = 1; i < data.length; i++) {
      var sId = String(data[i][sIdIdx] || '').trim();
      var jsonStr = data[i][jsonIdx];
      if (sId && jsonStr) {
        try {
          scheduleObj[sId] = JSON.parse(jsonStr);
        } catch (e) {
          // ignore parsing error
        }
      }
    }
    return scheduleObj;
  }

  // Fallback for legacy 6-column format
  for (var k = 1; k < data.length; k++) {
    var row = data[k];
    var staffId = String(row[0] || '').trim();
    var room = String(row[2] || '').trim();
    var month = Number(row[3]) || 11;
    var day = Number(row[4]) || 1;
    var shift = String(row[5] || 'Off').trim();

    if (staffId) {
      if (!scheduleObj[staffId]) scheduleObj[staffId] = {};
      if (!scheduleObj[staffId][month]) scheduleObj[staffId][month] = [];
      scheduleObj[staffId][month].push({
        day: day,
        month: month,
        shiftType: shift,
        room: room
      });
    }
  }
  return scheduleObj;
}

function saveStaffData(sheet, staffList) {
  if (!sheet || !staffList || staffList.length === 0) return;
  sheet.clearContents();
  
  var rows = [['id', 'name', 'role', 'password', 'avatar']];
  var seen = {};
  
  staffList.forEach(function (s) {
    var name = (s.name || '').trim();
    if (name && !seen[name]) {
      seen[name] = true;
      rows.push([s.id || '', s.name || '', s.role || '', s.password || '', s.avatar || '']);
    }
  });

  sheet.getRange(1, 1, rows.length, 5).setValues(rows);
}

function saveScheduleData(sheet, scheduleObj) {
  if (!sheet || !scheduleObj) return;
  sheet.clearContents();

  var rows = [['staffId', 'staffName', 'scheduleJson', 'updatedAt']];
  var now = new Date().toISOString();

  for (var staffId in scheduleObj) {
    var staffSched = scheduleObj[staffId];
    if (staffSched) {
      rows.push([staffId, '', JSON.stringify(staffSched), now]);
    }
  }

  if (rows.length > 1) {
    sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  } else {
    sheet.getRange(1, 1, 1, 4).setValues(rows);
  }
}

function saveSwapRequestsData(sheet, swapRequestsList) {
  if (!sheet) return;
  sheet.clearContents();

  var rows = [['id', 'requesterId', 'requesterName', 'partnerId', 'partnerName', 'room', 'myDay', 'myShift', 'targetDay', 'targetShift', 'status', 'createdAt', 'reviewedBy']];

  if (swapRequestsList && swapRequestsList.length > 0) {
    swapRequestsList.forEach(function (r) {
      rows.push([
        r.id || '',
        r.requesterId || '',
        r.requesterName || '',
        r.partnerId || '',
        r.partnerName || '',
        r.room || '',
        r.myDay || '',
        r.myShift || '',
        r.targetDay || '',
        r.targetShift || '',
        r.status || '',
        r.createdAt || '',
        r.reviewedBy || ''
      ]);
    });
  }

  sheet.getRange(1, 1, rows.length, 13).setValues(rows);
}


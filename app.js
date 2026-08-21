/**
 * Hospital Nurse Scheduling System - Core Javascript Logic
 * Handles: Data Generation, State Management, Authentication,
 * Render Views, Swap Request Workflows, Admin Approvals.
 */

class NurseSchedulingApp {
    constructor() {
        this.months = [
            { id: 1, name: 'มกราคม', shortName: 'ม.ค.', days: 31 },
            { id: 2, name: 'กุมภาพันธ์', shortName: 'ก.พ.', days: 28 },
            { id: 3, name: 'มีนาคม', shortName: 'มี.ค.', days: 31 },
            { id: 4, name: 'เมษายน', shortName: 'เม.ย.', days: 30 },
            { id: 5, name: 'พฤษภาคม', shortName: 'พ.ค.', days: 31 },
            { id: 6, name: 'มิถุนายน', shortName: 'มิ.ย.', days: 30 },
            { id: 7, name: 'กรกฎาคม', shortName: 'ก.ค.', days: 31 },
            { id: 8, name: 'สิงหาคม', shortName: 'ส.ค.', days: 31 },
            { id: 9, name: 'กันยายน', shortName: 'ก.ย.', days: 30 },
            { id: 10, name: 'ตุลาคม', shortName: 'ต.ค.', days: 31 },
            { id: 11, name: 'พฤศจิกายน', shortName: 'พ.ย.', days: 30 },
            { id: 12, name: 'ธันวาคม', shortName: 'ธ.ค.', days: 31 }
        ];

        this.state = {
            currentUser: null,
            staff: [],
            schedule: {},
            swapRequests: [],
            activeView: 'login', // login, room-selection, specific-room, admin-dashboard
            activeRoom: null, // null, ห้องER, ห้องคลอด, ห้องฉุกเฉิน
            searchQuery: '',
            adminSearchQuery: '',
            reportsSearchQuery: '',
            overviewPage: 1,
            overviewPageSize: 9,
            roomPage: 1,
            roomPageSize: 9,
            selectedMonth: 11 // Default month (11 = พฤศจิกายน)
        };

        // Static Credentials Mapping
        this.credentials = {
            staff: {
                "พี่เจม": "เจมซ่า",
                "โต้": "โต้โยต้า",
                "ชมพู่": "1111"
            },
            admin: {
                "พี่บัว": "เซล่ามูน",
                "พี่พลอย": "ชาบู"
            }
        };

        this.departments = ["ห้องER", "ห้องคลอด", "ห้องฉุกเฉิน"];
        this.shiftTypes = [
            { code: 'ช', name: 'เวรเช้า (Morning)', class: 'm' },
            { code: 'บ', name: 'เวรบ่าย (Afternoon)', class: 'a' },
            { code: 'ด', name: 'เวรดึก (Night)', class: 'n' },
            { code: 'Off', name: 'วันหยุด (Off)', class: 'off' }
        ];

        // Background image mapping for parallax effects
        this.backgrounds = {
            login: 'assets/hospital_entrance.png',
            'room-selection': 'assets/hospital_corridor.png',
            'specific-room': 'assets/hospital_office.png',
            admin: 'assets/server_room.png',
            'admin-reports': 'assets/server_room.png'
        };

        // Google Sheets Integration URL (Primary Database)
        this.defaultGoogleSheetUrl = 'https://script.google.com/macros/s/AKfycbw3rIXdiPRxCu6BU-b6CgFa2gUNUKA4bsT3lBz9Vqy7PP8bz-JeilwrUKzXgLvZAm5-/exec';
        this.googleSheetScriptUrl = localStorage.getItem('sukho_gsheet_script_url') || this.defaultGoogleSheetUrl;
    }

    async init() {
        // Load local cache or initial data first
        this.loadOrGenerateData();

        // Setup Event Listeners
        this.setupParallaxEffects();
        this.setupNavigation();
        this.restoreSession();

        // Populate Google Sheet URL input
        const gsheetUrlInput = document.getElementById('gsheet-script-url');
        if (gsheetUrlInput) {
            gsheetUrlInput.value = this.googleSheetScriptUrl;
        }

        // Real-time synchronization with Google Sheets as primary database
        if (this.googleSheetScriptUrl) {
            await this.syncGoogleSheetData(true);
        } else {
            this.updateGSheetStatusUI(false, 'โหมดข้อมูลท้องถิ่น (Local Mode)');
        }

        console.log("Sangkhlaburi Hospital Nurse Scheduling App Initialized with Google Sheets.");
    }

    // ==========================================================================
    // State & Data Generation
    // ==========================================================================
    // ==========================================================================
    // Shift Data Normalization & Helper Methods
    // ==========================================================================
    normalizeShiftEntry(shift, defaultRoom = 'ห้องER', dayNum = 1, monthNum = 11) {
        if (!shift) {
            return {
                day: Number(dayNum) || 1,
                month: Number(monthNum) || 11,
                shiftType: 'Off',
                room: 'Off',
                color1: '',
                shift2Type: '',
                room2: '',
                color2: ''
            };
        }

        if (typeof shift === 'string') {
            const str = shift.trim();
            if (str.includes('/') || str.includes('+') || str.includes(',')) {
                const parts = str.split(/[\/\+,]/).map(p => p.trim()).filter(Boolean);
                const s1 = parts[0] || 'Off';
                const s2 = parts[1] || '';
                return {
                    day: Number(dayNum) || 1,
                    month: Number(monthNum) || 11,
                    shiftType: s1,
                    room: s1 === 'Off' ? 'Off' : defaultRoom,
                    color1: '',
                    shift2Type: s2 && s2 !== 'Off' ? s2 : '',
                    room2: s2 && s2 !== 'Off' ? defaultRoom : '',
                    color2: ''
                };
            } else {
                return {
                    day: Number(dayNum) || 1,
                    month: Number(monthNum) || 11,
                    shiftType: str || 'Off',
                    room: str === 'Off' ? 'Off' : defaultRoom,
                    color1: '',
                    shift2Type: '',
                    room2: '',
                    color2: ''
                };
            }
        }

        if (typeof shift === 'object' && shift !== null) {
            let s1 = shift.shiftType || shift.shiftCode || 'Off';
            let r1 = shift.room || (s1 === 'Off' ? 'Off' : defaultRoom);
            let c1 = shift.color1 || shift.customColor1 || '';

            let s2 = shift.shift2Type || shift.shift2Code || '';
            let r2 = shift.room2 || (s2 && s2 !== 'Off' ? (r1 !== 'Off' ? r1 : defaultRoom) : '');
            let c2 = shift.color2 || shift.customColor2 || '';

            if (typeof s1 === 'string' && (s1.includes('/') || s1.includes('+') || s1.includes(','))) {
                const parts = s1.split(/[\/\+,]/).map(p => p.trim()).filter(Boolean);
                s1 = parts[0] || 'Off';
                if (!s2 && parts[1] && parts[1] !== 'Off') {
                    s2 = parts[1];
                    r2 = r2 || r1;
                }
            }

            if (s1 === '[object Object]' || !s1) s1 = 'Off';
            if (r1 === '[object Object]' || !r1) r1 = s1 === 'Off' ? 'Off' : defaultRoom;
            if (s2 === '[object Object]' || s2 === 'Off') s2 = '';
            if (r2 === '[object Object]' || !r2) r2 = s2 ? (r1 !== 'Off' ? r1 : defaultRoom) : '';

            return {
                day: Number(shift.day) || dayNum,
                month: Number(shift.month) || monthNum,
                shiftType: String(s1),
                room: String(r1),
                color1: String(c1 || ''),
                shift2Type: String(s2 || ''),
                room2: String(r2 || ''),
                color2: String(c2 || '')
            };
        }

        return {
            day: Number(dayNum) || 1,
            month: Number(monthNum) || 11,
            shiftType: 'Off',
            room: 'Off',
            color1: '',
            shift2Type: '',
            room2: '',
            color2: ''
        };
    }

    getShiftsArrayForDay(shiftObj) {
        if (!shiftObj) return [{ shiftType: 'Off', room: 'Off', color: '' }];
        const norm = this.normalizeShiftEntry(shiftObj);
        if (norm.shiftType === 'Off' && !norm.shift2Type) {
            return [{ shiftType: 'Off', room: 'Off', color: norm.color1 }];
        }
        const result = [];
        if (norm.shiftType && norm.shiftType !== 'Off') {
            result.push({ shiftType: norm.shiftType, room: norm.room, color: norm.color1 });
        }
        if (norm.shift2Type && norm.shift2Type !== 'Off') {
            result.push({ shiftType: norm.shift2Type, room: norm.room2 || norm.room, color: norm.color2 });
        }
        return result.length > 0 ? result : [{ shiftType: 'Off', room: 'Off', color: '' }];
    }

    getShiftStyleAndClass(shiftCode, roomName) {
        if (shiftCode === 'Off' || roomName === 'Off') {
            return { className: 'off', style: '' };
        }
        if (roomName === 'ห้องER') {
            return { className: 'room-er', style: '' };
        }
        if (roomName === 'ห้องคลอด') {
            return { className: 'room-delivery', style: '' };
        }
        if (roomName === 'ห้องฉุกเฉิน') {
            return { className: 'room-accident', style: '' };
        }
        if (shiftCode === 'ช') return { className: 'room-accident', style: '' };
        if (shiftCode === 'บ') return { className: 'room-delivery', style: '' };
        if (shiftCode === 'ด') return { className: 'room-er', style: '' };
        return { className: 'off', style: '' };
    }

    // ==========================================================================
    // Consecutive Shift Rest Rules Validation Engine
    // ==========================================================================
    validateConsecutiveShifts(todayShift, tomorrowShift) {
        if (!todayShift || !tomorrowShift) {
            return { valid: true, level: 'valid', message: 'เวรนี้ถูกต้องตามเกณฑ์เวลาพักผ่อน' };
        }

        const todayArr = this.getShiftsArrayForDay(todayShift);
        const tomorrowArr = this.getShiftsArrayForDay(tomorrowShift);

        const todayTypes = todayArr.map(s => s.shiftType);
        const tomorrowTypes = tomorrowArr.map(s => s.shiftType);

        // If either day is Off only, always valid
        if (todayTypes.length === 1 && todayTypes[0] === 'Off') {
            return { valid: true, level: 'valid', message: 'เวรนี้ถูกต้องตามเกณฑ์เวลาพักผ่อน' };
        }
        if (tomorrowTypes.length === 1 && tomorrowTypes[0] === 'Off') {
            return { valid: true, level: 'valid', message: 'เวรนี้ถูกต้องตามเกณฑ์เวลาพักผ่อน' };
        }

        // Rule 1: วันนี้เข้า บ่าย + ดึก (บ, ด) -> พรุ่งนี้เข้ากะเช้าไม่ได้ (ห้าม ช)
        if (todayTypes.includes('บ') && todayTypes.includes('ด')) {
            if (tomorrowTypes.includes('ช')) {
                return {
                    valid: false,
                    level: 'invalid',
                    ruleName: 'บ่าย+ดึก -> ห้ามต่อเช้า',
                    message: 'วันนี้เข้าเวร [บ่าย + ดึก] พรุ่งนี้ไม่สามารถเข้า [เวรเช้า (ช)] ได้ เนื่องจากไม่มีเวลาพักผ่อนขั้นต่ำ'
                };
            }
        }

        // Rule 2: วันนี้เข้า เช้า + บ่าย (ช, บ) -> พรุ่งนี้เข้ากะดึกไม่ได้ (ห้าม ด)
        if (todayTypes.includes('ช') && todayTypes.includes('บ')) {
            if (tomorrowTypes.includes('ด')) {
                return {
                    valid: false,
                    level: 'invalid',
                    ruleName: 'เช้า+บ่าย -> ห้ามต่อดึก',
                    message: 'วันนี้เข้าเวร [เช้า + บ่าย] พรุ่งนี้ไม่สามารถเข้า [เวรดึก (ด)] ได้ เนื่องจากออกเวร 24:00 น. ไม่สามารถต่อดึกทันที'
                };
            }
        }

        // Rule 3: วันนี้เข้า ดึก + เช้า (ด, ช) -> พรุ่งนี้เข้ากะบ่ายไม่ได้ (ห้าม บ)
        if (todayTypes.includes('ด') && todayTypes.includes('ช')) {
            if (tomorrowTypes.includes('บ')) {
                return {
                    valid: false,
                    level: 'invalid',
                    ruleName: 'ดึก+เช้า -> ห้ามต่อบ่าย',
                    message: 'วันนี้เข้าเวร [ดึก + เช้า] พรุ่งนี้ไม่สามารถเข้า [เวรบ่าย (บ)] ได้ เพื่อให้มีเวลาพักผ่อนเพียงพอ'
                };
            }
        }

        // Rule 4 (Single shift rest): วันนี้เข้า ดึก (ด) อย่างเดียว -> พรุ่งนี้เข้ากะเช้า (ช) ไม่ได้
        if (todayTypes.includes('ด') && !todayTypes.includes('ช') && !todayTypes.includes('บ')) {
            if (tomorrowTypes.includes('ช')) {
                return {
                    valid: false,
                    level: 'invalid',
                    ruleName: 'ดึก -> ห้ามต่อเช้า',
                    message: 'วันนี้ออกเวรดึก (08:00) พรุ่งนี้ไม่ควรต่อเวรเช้าทันที'
                };
            }
        }

        return { valid: true, level: 'valid', message: 'เวรนี้ถูกต้องตามเกณฑ์เวลาพักผ่อน (Rest Constraint Passed)' };
    }

    validateNurseDayShift(nurseId, month, day, candidateShift) {
        const shifts = this.getNurseShiftsForMonth(nurseId, month);
        const dayIdx = day - 1;

        // Check with yesterday
        if (dayIdx > 0) {
            const yesterdayShift = shifts[dayIdx - 1];
            const resPrev = this.validateConsecutiveShifts(yesterdayShift, candidateShift);
            if (!resPrev.valid) {
                return {
                    valid: false,
                    level: resPrev.level,
                    message: `[ขัดแย้งกับเมื่อวาน วันที่ ${day - 1}]: ${resPrev.message}`
                };
            }
        }

        // Check with tomorrow
        if (dayIdx < shifts.length - 1) {
            const tomorrowShift = shifts[dayIdx + 1];
            const resNext = this.validateConsecutiveShifts(candidateShift, tomorrowShift);
            if (!resNext.valid) {
                return {
                    valid: false,
                    level: resNext.level,
                    message: `[ขัดแย้งกับพรุ่งนี้ วันที่ ${day + 1}]: ${resNext.message}`
                };
            }
        }

        return { valid: true, level: 'valid', message: 'เวรนี้ถูกต้องตามเกณฑ์เวลาพักผ่อนทั้งหมด' };
    }

    // ==========================================================================
    // Smart Schedule Generator (with 1-2 Shifts per day & Strict Rest Rules)
    // ==========================================================================
    generateSmartMonthShifts(monthId, daysCount, defaultDept) {
        const monthShifts = [];

        const singleOptions = [
            { shiftType: 'ช', shift2Type: '' },
            { shiftType: 'บ', shift2Type: '' },
            { shiftType: 'ด', shift2Type: '' }
        ];

        const dualOptions = [
            { shiftType: 'ช', shift2Type: 'บ' },
            { shiftType: 'บ', shift2Type: 'ด' },
            { shiftType: 'ด', shift2Type: 'ช' }
        ];

        let prevShift = null;

        for (let d = 1; d <= daysCount; d++) {
            let candidate = null;
            let attempts = 0;

            while (attempts < 25) {
                attempts++;
                const rand = Math.random();
                if (rand < 0.22) {
                    // Off day (22%)
                    candidate = {
                        day: d,
                        month: monthId,
                        shiftType: 'Off',
                        room: 'Off',
                        color1: '',
                        shift2Type: '',
                        room2: '',
                        color2: ''
                    };
                } else if (rand < 0.82) {
                    // Single shift (60%)
                    const s = singleOptions[Math.floor(Math.random() * singleOptions.length)];
                    const r = this.departments[Math.floor(Math.random() * this.departments.length)];
                    candidate = {
                        day: d,
                        month: monthId,
                        shiftType: s.shiftType,
                        room: r,
                        color1: '',
                        shift2Type: '',
                        room2: '',
                        color2: ''
                    };
                } else {
                    // Dual shift (18%)
                    const s = dualOptions[Math.floor(Math.random() * dualOptions.length)];
                    const r1 = this.departments[Math.floor(Math.random() * this.departments.length)];
                    const r2 = this.departments[Math.floor(Math.random() * this.departments.length)];
                    candidate = {
                        day: d,
                        month: monthId,
                        shiftType: s.shiftType,
                        room: r1,
                        color1: '',
                        shift2Type: s.shift2Type,
                        room2: r2,
                        color2: ''
                    };
                }

                if (!prevShift) break;

                const check = this.validateConsecutiveShifts(prevShift, candidate);
                if (check.valid) break;
            }

            if (!candidate) {
                candidate = {
                    day: d,
                    month: monthId,
                    shiftType: 'Off',
                    room: 'Off',
                    color1: '',
                    shift2Type: '',
                    room2: '',
                    color2: ''
                };
            }

            prevShift = candidate;
            monthShifts.push(candidate);
        }

        return monthShifts;
    }

    getNurseShiftsForMonth(nurseId, month = this.state.selectedMonth) {
        let staffSchedule = this.state.schedule[nurseId];
        if (!staffSchedule) return [];

        const staffObj = this.state.staff.find(s => s.id === nurseId);
        const defaultDept = staffObj ? staffObj.primaryDept : 'ห้องER';

        // If staffSchedule is an old single-month array, migrate it to a 12-month object
        if (Array.isArray(staffSchedule)) {
            const yearObj = {};
            this.months.forEach(m => {
                if (m.id === 11) {
                    yearObj[m.id] = staffSchedule.map((s, idx) => this.normalizeShiftEntry(s, defaultDept, idx + 1, m.id));
                } else {
                    yearObj[m.id] = this.generateSmartMonthShifts(m.id, m.days, defaultDept);
                }
            });
            this.state.schedule[nurseId] = yearObj;
            staffSchedule = yearObj;
            localStorage.setItem('sukho_schedule', JSON.stringify(this.state.schedule));
        }

        const monthKey = Number(month);
        if (isNaN(monthKey)) return [];

        const existingShifts = staffSchedule[monthKey] || staffSchedule[String(monthKey)];
        if (existingShifts && Array.isArray(existingShifts) && existingShifts.length > 0) {
            // Ensure every shift is normalized
            return existingShifts.map((s, idx) => this.normalizeShiftEntry(s, defaultDept, idx + 1, monthKey));
        }

        const mInfo = this.months.find(m => m.id === monthKey) || { days: 30 };
        const monthShifts = this.generateSmartMonthShifts(monthKey, mInfo.days, defaultDept);
        staffSchedule[monthKey] = monthShifts;
        localStorage.setItem('sukho_schedule', JSON.stringify(this.state.schedule));

        return monthShifts;
    }

    renderMonthSelector() {
        const containers = document.querySelectorAll('.month-selector-container');
        if (!containers || containers.length === 0) return;

        containers.forEach(container => {
            container.innerHTML = `
                <div class="month-pagination-bar glass-panel">
                    <span class="month-pagination-title"><i class="fa-solid fa-calendar-days"></i> เลือกเดือน:</span>
                    <div class="month-btn-group">
                        ${this.months.map(m => `
                            <button type="button" class="month-btn ${Number(m.id) === Number(this.state.selectedMonth) ? 'active' : ''}" onclick="window.app.changeSelectedMonth(${m.id})">
                                ${m.shortName}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }

    changeSelectedMonth(monthId) {
        this.state.selectedMonth = parseInt(monthId, 10);
        this.state.overviewPage = 1;
        this.state.roomPage = 1;

        const staffModal = document.getElementById('staff-detail-modal');
        if (staffModal && staffModal.classList.contains('active') && this.state.activeModalNurseId) {
            this.openNurseIndividualSchedule(this.state.activeModalNurseId);
        } else {
            this.renderCurrentView();
        }
    }

    loadOrGenerateData() {
        const storedStaff = localStorage.getItem('sukho_staff');
        const storedSchedule = localStorage.getItem('sukho_schedule');
        const storedRequests = localStorage.getItem('sukho_swap_requests');

        if (storedStaff && storedSchedule) {
            try {
                this.state.staff = JSON.parse(storedStaff);
                const depts = ['ห้องER', 'ห้องคลอด', 'ห้องฉุกเฉิน'];
                this.state.staff.forEach((s, idx) => {
                    if (!s.primaryDept || s.primaryDept === 'undefined' || s.primaryDept === 'null') {
                        if (s.name === 'ชมพู่') s.primaryDept = 'ห้องคลอด';
                        else if (s.name === 'โต้') s.primaryDept = 'ห้องฉุกเฉิน';
                        else if (s.name === 'พี่เจม') s.primaryDept = 'ห้องER';
                        else if (s.role === 'admin') s.primaryDept = 'ฝ่ายการพยาบาล';
                        else s.primaryDept = depts[idx % depts.length];
                    }
                });
                const parsedSchedule = JSON.parse(storedSchedule);
                this.state.schedule = parsedSchedule;
                localStorage.setItem('sukho_staff', JSON.stringify(this.state.staff));
            } catch (e) {
                this.generateInitialData();
            }
        } else {
            this.generateInitialData();
        }

        if (storedRequests) {
            try {
                const parsed = JSON.parse(storedRequests);
                this.state.swapRequests = parsed.filter(req => req.id && !req.id.startsWith('req-sample-'));
            } catch (e) {
                this.state.swapRequests = [];
            }
        } else {
            this.state.swapRequests = [];
        }
        localStorage.setItem('sukho_swap_requests', JSON.stringify(this.state.swapRequests));
    }

    getCompleteDefaultStaffList() {
        const staffList = [
            { id: 'staff-james', name: 'พี่เจม', role: 'staff', primaryDept: 'ห้องER' },
            { id: 'staff-to', name: 'โต้', role: 'staff', primaryDept: 'ห้องฉุกเฉิน' },
            { id: 'staff-chompoo', name: 'ชมพู่', role: 'staff', primaryDept: 'ห้องคลอด' },
            { id: 'admin-bua', name: 'พี่บัว', role: 'admin', primaryDept: 'ฝ่ายการพยาบาล' },
            { id: 'admin-ploy', name: 'พี่พลอย', role: 'admin', primaryDept: 'ฝ่ายการพยาบาล' }
        ];

        const thaiFirstNames = [
            "สมจิต", "นงลักษณ์", "วันเพ็ญ", "สุภัทรา", "มยุรี", "กนกวรรณ", "พิมลพรรณ", "อุมาพร", 
            "วิไลวรรณ", "อรอนงค์", "จันทิมา", "ปรียานุช", "ศิริพรรณ", "จรรยา", "วรรณิศา", "สุจิตรา", 
            "รุ่งทิพย์", "วิลาสินี", "ทิพยวัลย์", "นุชนาถ", "ดาริกา", "ลัดดา", "ศิริพร", "ยุพา"
        ];
        const thaiLastNames = [
            "รักสงบ", "เกียรติดำรง", "ศิริวัฒน์", "สุขสวัสดิ์", "เลิศวิจิตร", "พานิชยการ", "วงษ์สุวรรณ", 
            "บุญมี", "จงเจริญ", "ทรัพย์เพิ่ม", "เจริญรุ่งเรือง", "วัฒนพงษ์", "ใจดี", "ประเสริฐยิ่ง", 
            "แก้วมณี", "ทองอ่อน", "ศรีสุข", "รุ่งเรืองวิโรจน์", "พงษ์ไทย"
        ];

        for (let i = 1; i <= 45; i++) {
            const fName = thaiFirstNames[(i - 1) % thaiFirstNames.length];
            const lName = thaiLastNames[(i - 1) % thaiLastNames.length];
            const dept = this.departments[(i - 1) % this.departments.length];
            staffList.push({
                id: `staff-mock-${i}`,
                name: `พว. ${fName} ${lName}`,
                role: 'staff',
                primaryDept: dept
            });
        }
        return staffList;
    }

    generateInitialData() {
        const staffList = this.getCompleteDefaultStaffList();
        const scheduleMap = {};

        const workingStaff = staffList.filter(s => s.role === 'staff');
        workingStaff.forEach(staff => {
            const yearSchedule = {};
            this.months.forEach(m => {
                yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, staff.primaryDept);
            });
            scheduleMap[staff.id] = yearSchedule;
        });

        this.state.staff = staffList;
        this.state.schedule = scheduleMap;
        localStorage.setItem('sukho_staff', JSON.stringify(staffList));
        localStorage.setItem('sukho_schedule', JSON.stringify(scheduleMap));
    }

    saveStateToLocalStorage() {
        localStorage.setItem('sukho_staff', JSON.stringify(this.state.staff));
        localStorage.setItem('sukho_schedule', JSON.stringify(this.state.schedule));
        localStorage.setItem('sukho_swap_requests', JSON.stringify(this.state.swapRequests));

        // Auto push to Google Sheet if connected
        if (this.googleSheetScriptUrl) {
            this.pushLocalToGoogleSheet(true);
        }
    }

    // ==========================================================================
    // Google Sheets Integration Methods
    // ==========================================================================
    async saveGoogleSheetUrl() {
        const urlInput = document.getElementById('gsheet-script-url');
        if (!urlInput) return;
        const url = urlInput.value.trim();
        if (!url) {
            this.showToast('กรุณากรอก Web App URL ก่อนบันทึก', 'error');
            return;
        }

        // Validate URL type
        if (url.includes('docs.google.com/spreadsheets')) {
            this.showToast('กรุณาใช้ Web App URL (ที่เริ่มด้วย script.google.com และลงท้ายด้วย /exec) ไม่ใช่ URL ของหน้า Google Sheet ครับ', 'error');
            return;
        }

        if (!url.includes('script.google.com')) {
            this.showToast('รูปแบบ Web App URL ไม่ถูกต้อง (ต้องเป็น https://script.google.com/macros/s/.../exec)', 'error');
            return;
        }

        this.googleSheetScriptUrl = url;
        localStorage.setItem('sukho_gsheet_script_url', url);
        this.showToast('บันทึก Web App URL เรียบร้อย กำลังซิงค์ข้อมูล...', 'info');
        await this.syncGoogleSheetData();
    }

    async syncGoogleSheetData(isSilent = false) {
        if (!this.googleSheetScriptUrl) {
            this.updateGSheetStatusUI(false, 'โหมดข้อมูลท้องถิ่น (Local Mode)');
            if (!isSilent) this.showToast('ยังไม่ได้เชื่อมต่อ Google Sheet URL', 'info');
            return;
        }

        try {
            this.updateGSheetStatusUI(false, 'กำลังเชื่อมต่อ Google Sheet...');
            const response = await fetch(this.googleSheetScriptUrl);
            const data = await response.json();

            if (data && data.status === 'success') {
                // 1. Sync & Complete full 50 staff list
                const fullDefault = this.getCompleteDefaultStaffList();
                const mergedStaff = [];
                const seenNames = new Set();

                // Add staff from Google Sheet if any
                if (data.staff && data.staff.length > 0) {
                    data.staff.forEach(s => {
                        const nameKey = (s.name || '').trim();
                        if (nameKey && !seenNames.has(nameKey)) {
                            seenNames.add(nameKey);
                            mergedStaff.push({
                                id: s.id || `staff-${mergedStaff.length + 1}`,
                                name: s.name,
                                role: s.role || (s.name.includes('พี่บัว') || s.name.includes('พี่พลอย') ? 'admin' : 'staff'),
                                primaryDept: s.room || s.primaryDept || (s.role === 'admin' ? 'ฝ่ายการพยาบาล' : 'ห้องER'),
                                avatar: s.avatar || ''
                            });
                        }
                    });
                }

                // Fill remaining from default list so there are always 50 staff
                fullDefault.forEach(defStaff => {
                    if (!seenNames.has(defStaff.name)) {
                        seenNames.add(defStaff.name);
                        mergedStaff.push(defStaff);
                    }
                });

                this.state.staff = mergedStaff;
                localStorage.setItem('sukho_staff', JSON.stringify(mergedStaff));

                // 2. Sync schedule
                const normalizedGSheetSched = data.schedule ? this.normalizeScheduleFromGSheet(data.schedule) : {};
                const workingStaff = this.state.staff.filter(s => s.role === 'staff');
                let needPush = false;

                workingStaff.forEach(staff => {
                    const hasValidSched = normalizedGSheetSched[staff.id] && Object.values(normalizedGSheetSched[staff.id]).some(shifts => Array.isArray(shifts) && shifts.length > 0);
                    if (!hasValidSched) {
                        const yearSchedule = {};
                        this.months.forEach(m => {
                            yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, staff.primaryDept || 'ห้องER');
                        });
                        normalizedGSheetSched[staff.id] = yearSchedule;
                        needPush = true;
                    }
                });

                this.state.schedule = normalizedGSheetSched;
                localStorage.setItem('sukho_schedule', JSON.stringify(normalizedGSheetSched));

                // 3. Sync swap requests
                if (data.swapRequests) {
                    const cleanRequests = data.swapRequests.filter(req => req.id && !req.id.startsWith('req-sample-'));
                    this.state.swapRequests = cleanRequests;
                    localStorage.setItem('sukho_swap_requests', JSON.stringify(cleanRequests));
                }

                if (needPush || (data.staff && data.staff.length < 50)) {
                    this.pushLocalToGoogleSheet(true);
                }

                this.updateGSheetStatusUI(true, 'เชื่อมต่อ Google Sheet สำเร็จ');
                if (!isSilent) this.showToast('ดึงข้อมูลจาก Google Sheet สำเร็จแล้ว', 'success');

                // Re-render UI
                if (this.state.activeView) {
                    this.renderCurrentView();
                }
            } else {
                throw new Error(data ? data.message : 'Invalid response');
            }
        } catch (err) {
            console.error('Google Sheet Sync Error:', err);
            this.updateGSheetStatusUI(false, 'การเชื่อมต่อขัดข้อง (ใช้ Local Data)');
            if (!isSilent) {
                this.showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet (โปรดตรวจสอบการ Deploy Web App เป็น "Anyone")', 'error');
            }
        }
    }

    async pushLocalToGoogleSheet(isSilent = false) {
        if (!this.googleSheetScriptUrl) {
            if (!isSilent) this.showToast('กรุณากรอก Web App URL ในเมนูตั้งค่าก่อน', 'error');
            return;
        }

        try {
            if (!isSilent) this.showToast('กำลังส่งข้อมูลขึ้น Google Sheet...', 'info');

            const payload = {
                action: 'save_all',
                staff: this.state.staff,
                schedule: this.state.schedule,
                swapRequests: this.state.swapRequests
            };

            await fetch(this.googleSheetScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            this.updateGSheetStatusUI(true, 'ซิงค์ข้อมูลกับ Google Sheet แล้ว');
            if (!isSilent) this.showToast('ส่งข้อมูลขึ้น Google Sheet สำเร็จเรียบร้อย', 'success');
        } catch (err) {
            console.error('Google Sheet Push Error:', err);
            if (!isSilent) this.showToast('ไม่สามารถส่งข้อมูลขึ้น Google Sheet ได้', 'error');
        }
    }

    async randomizeAllSchedules(confirmUser = true) {
        if (confirmUser && !confirm('คุณต้องการสุ่มตารางเวรให้พนักงานทั้งหมดใหม่สำหรับทั้ง 12 เดือน (รองรับ 1-2 กะ/วัน พร้อมกฎพักผ่อน) ใช่หรือไม่?')) {
            return;
        }

        this.showToast('กำลังสุ่มและบันทึกตารางเวร 12 เดือนลง Google Sheet...', 'info');

        const workingStaff = this.state.staff.filter(s => s.role === 'staff');
        const newScheduleMap = {};

        workingStaff.forEach(staff => {
            const yearSchedule = {};
            this.months.forEach(m => {
                yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, staff.primaryDept);
            });
            newScheduleMap[staff.id] = yearSchedule;
        });

        this.state.schedule = newScheduleMap;
        localStorage.setItem('sukho_schedule', JSON.stringify(this.state.schedule));
        this.renderCurrentView();

        // Push directly to Google Sheet
        await this.pushLocalToGoogleSheet(false);
    }

    normalizeScheduleFromGSheet(rawSchedule) {
        const normalized = {};
        for (let sId in rawSchedule) {
            const rawData = rawSchedule[sId];
            const staffObj = this.state.staff.find(s => s.id === sId);
            const defaultRoom = staffObj ? staffObj.primaryDept : 'ห้องER';
            const yearSchedule = {};

            if (Array.isArray(rawData)) {
                // Legacy single-month array -> map into month 11, generate other months
                this.months.forEach(m => {
                    if (m.id === 11) {
                        yearSchedule[m.id] = rawData.map((item, idx) => this.normalizeShiftEntry(item, defaultRoom, idx + 1, 11));
                    } else {
                        const existingShifts = this.state.schedule[sId] && this.state.schedule[sId][m.id];
                        if (existingShifts && existingShifts.length > 0) {
                            yearSchedule[m.id] = existingShifts.map((s, idx) => this.normalizeShiftEntry(s, defaultRoom, idx + 1, m.id));
                        } else {
                            yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, defaultRoom);
                        }
                    }
                });
            } else if (typeof rawData === 'object' && rawData !== null) {
                const keys = Object.keys(rawData);
                const hasMonthKeys = keys.some(k => Number(k) >= 1 && Number(k) <= 12);

                if (hasMonthKeys) {
                    this.months.forEach(m => {
                        const monthData = rawData[m.id] || rawData[String(m.id)];
                        if (Array.isArray(monthData)) {
                            yearSchedule[m.id] = monthData.map((item, idx) => this.normalizeShiftEntry(item, defaultRoom, idx + 1, m.id));
                        } else {
                            const existingShifts = this.state.schedule[sId] && this.state.schedule[sId][m.id];
                            if (existingShifts && existingShifts.length > 0) {
                                yearSchedule[m.id] = existingShifts.map((s, idx) => this.normalizeShiftEntry(s, defaultRoom, idx + 1, m.id));
                            } else {
                                yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, defaultRoom);
                            }
                        }
                    });
                } else {
                    // rawData is mapped by day for month 11
                    this.months.forEach(m => {
                        if (m.id === 11) {
                            const shifts = [];
                            for (let d = 1; d <= 30; d++) {
                                const val = rawData[d] || rawData[String(d)];
                                shifts.push(this.normalizeShiftEntry(val, defaultRoom, d, 11));
                            }
                            yearSchedule[m.id] = shifts;
                        } else {
                            const existingShifts = this.state.schedule[sId] && this.state.schedule[sId][m.id];
                            if (existingShifts && existingShifts.length > 0) {
                                yearSchedule[m.id] = existingShifts.map((s, idx) => this.normalizeShiftEntry(s, defaultRoom, idx + 1, m.id));
                            } else {
                                yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, defaultRoom);
                            }
                        }
                    });
                }
            }
            normalized[sId] = yearSchedule;
        }
        return Object.keys(normalized).length > 0 ? normalized : this.state.schedule;
    }

    updateGSheetStatusUI(isOnline, text) {
        const badge = document.getElementById('gsheet-status-badge');
        const loginText = document.getElementById('login-gsheet-status-text');
        
        if (badge) {
            badge.textContent = isOnline ? 'Online' : 'Local';
            badge.className = `badge-status ${isOnline ? 'online' : 'offline'}`;
        }
        if (loginText) {
            loginText.textContent = `สถานะ: ${text}`;
        }
    }

    renderCurrentView() {
        if (this.state.activeView === 'room-selection') {
            this.renderOverviewGrid();
            this.updateStats();
        } else if (this.state.activeView === 'specific-room') {
            this.renderSpecificRoomView();
        } else if (this.state.activeView === 'admin-dashboard') {
            this.renderAdminDashboard();
        } else if (this.state.activeView === 'admin-reports') {
            this.renderAdminReports();
        }
    }

    // ==========================================================================
    // Interaction & UI Navigation
    // ==========================================================================
    setupParallaxEffects() {
        // Dynamic mouse movement parallax
        document.addEventListener('mousemove', (e) => {
            const bg = document.getElementById('parallax-bg');
            if (bg) {
                const x = (window.innerWidth / 2 - e.clientX) / 70;
                const y = (window.innerHeight / 2 - e.clientY) / 70;
                bg.style.transform = `translate(${x}px, ${y}px) scale(1.06)`;
            }
        });
    }

    setupNavigation() {
        // Toggle Room Dropdown manually if clicked
        const dropdownBtn = document.getElementById('room-dropdown-btn');
        if (dropdownBtn) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = dropdownBtn.nextElementSibling;
                const isVisible = menu.style.display === 'block';
                menu.style.display = isVisible ? 'none' : 'block';
            });
        }

        document.addEventListener('click', () => {
            const dropdownMenu = document.querySelector('.room-dropdown .dropdown-menu');
            if (dropdownMenu) dropdownMenu.style.display = 'none';
        });
    }

    updateNavigationElements() {
        const navAdmin = document.getElementById('nav-btn-admin-dash');
        const navReports = document.getElementById('nav-btn-admin-reports');
        const navGsheet = document.getElementById('nav-btn-gsheet');
        const roomDropdown = document.getElementById('room-dropdown');
        const roomNavSection = document.querySelector('.room-nav-section');

        if (this.state.currentUser && this.state.currentUser.role === 'admin') {
            if (navAdmin) navAdmin.classList.remove('hidden');
            if (navReports) navReports.classList.remove('hidden');
            if (navGsheet) navGsheet.classList.remove('hidden');
            if (roomDropdown) roomDropdown.classList.add('hidden');
            if (roomNavSection) roomNavSection.classList.add('hidden');
        } else {
            if (navAdmin) navAdmin.classList.add('hidden');
            if (navReports) navReports.classList.add('hidden');
            if (navGsheet) navGsheet.classList.add('hidden');
            if (roomDropdown) roomDropdown.classList.remove('hidden');
            if (roomNavSection) roomNavSection.classList.remove('hidden');
        }
    }

    changeView(viewName) {
        this.state.activeView = viewName;

        // Hide all screens
        document.querySelectorAll('.screen-view').forEach(s => s.classList.remove('active'));

        // Switch screen background image
        const bg = document.getElementById('parallax-bg');
        if (bg) {
            let bgKey = viewName;
            if (viewName === 'specific-room') bgKey = 'specific-room';
            if (viewName === 'room-selection') bgKey = 'room-selection';
            if (viewName === 'admin-dashboard') bgKey = 'admin';
            if (viewName === 'admin-reports') bgKey = 'admin-reports';
            if (viewName === 'login') bgKey = 'login';
            bg.style.backgroundImage = `url('${this.backgrounds[bgKey]}')`;
        }

        // Show header only if not login screen
        const header = document.getElementById('main-header');
        if (viewName === 'login') {
            header.classList.add('hidden');
        } else {
            header.classList.remove('hidden');
        }

        // Activate specific screen view
        if (viewName === 'login') {
            document.getElementById('screen-login').classList.add('active');
        } else if (viewName === 'room-selection') {
            document.getElementById('screen-room-selection').classList.add('active');
            this.renderOverviewGrid();
            this.updateStats();
        } else if (viewName === 'specific-room') {
            document.getElementById('screen-specific-room').classList.add('active');
            this.renderSpecificRoomView();
        } else if (viewName === 'admin-dashboard') {
            document.getElementById('screen-admin-dashboard').classList.add('active');
            this.renderAdminDashboard();
        } else if (viewName === 'admin-reports') {
            document.getElementById('screen-admin-reports').classList.add('active');
            this.renderAdminReports();
        }

        // Manage active nav state
        const navAll = document.getElementById('nav-btn-all');
        const navAdmin = document.getElementById('nav-btn-admin-dash');
        const navReports = document.getElementById('nav-btn-admin-reports');
        if (viewName === 'room-selection') {
            if (navAll) navAll.classList.add('active');
            if (navAdmin) navAdmin.classList.remove('active');
            if (navReports) navReports.classList.remove('active');
        } else if (viewName === 'admin-dashboard') {
            if (navAll) navAll.classList.remove('active');
            if (navAdmin) navAdmin.classList.add('active');
            if (navReports) navReports.classList.remove('active');
        } else if (viewName === 'admin-reports') {
            if (navAll) navAll.classList.remove('active');
            if (navAdmin) navAdmin.classList.remove('active');
            if (navReports) navReports.classList.add('active');
        } else {
            if (navAll) navAll.classList.remove('active');
            if (navAdmin) navAdmin.classList.remove('active');
            if (navReports) navReports.classList.remove('active');
        }

        // Apply role-based navigation element visibility
        this.updateNavigationElements();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==========================================================================
    // Session Management
    // ==========================================================================
    restoreSession() {
        const storedUser = localStorage.getItem('sukho_current_user');
        if (storedUser) {
            this.state.currentUser = JSON.parse(storedUser);
            this.updateProfileWidget();
            if (this.state.currentUser.role === 'admin') {
                this.changeView('admin-dashboard');
            } else {
                this.changeView('room-selection');
            }
        } else {
            this.changeView('login');
        }
    }

    handleLogin(event, role) {
        event.preventDefault();
        const usernameId = role === 'staff' ? 'staff-username' : 'admin-username';
        const passwordId = role === 'staff' ? 'staff-password' : 'admin-password';

        const username = document.getElementById(usernameId).value.trim();
        const password = document.getElementById(passwordId).value;

        const allowedPasswords = this.credentials[role];

        if (allowedPasswords && allowedPasswords[username] === password) {
            // Find staff object
            let userObj = this.state.staff.find(s => s.name === username && s.role === role);
            
            // If user object not found (e.g. mock accounts or edge cases), create a placeholder
            if (!userObj) {
                userObj = {
                    id: role === 'admin' ? `admin-${Date.now()}` : `staff-${Date.now()}`,
                    name: username,
                    role: role,
                    primaryDept: role === 'admin' ? 'ฝ่ายการพยาบาล' : 'ห้องER'
                };
            }

            this.state.currentUser = userObj;
            localStorage.setItem('sukho_current_user', JSON.stringify(userObj));
            this.updateProfileWidget();

            // Clear login inputs
            document.getElementById(usernameId).value = '';
            document.getElementById(passwordId).value = '';
            this.closeModal(`${role}-login-modal`);

            this.showToast(`ยินดีต้อนรับคุณ ${username} เข้าสู่ระบบ`, 'success');

            if (role === 'admin') {
                this.changeView('admin-dashboard');
            } else {
                this.changeView('room-selection');
            }
        } else {
            this.showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", "error");
        }
    }

    quickLogin(role, username, password) {
        let userObj = this.state.staff.find(s => s.name === username && s.role === role);
        if (!userObj) {
            userObj = {
                id: role === 'admin' ? `admin-${Date.now()}` : `staff-${Date.now()}`,
                name: username,
                role: role,
                primaryDept: role === 'admin' ? 'ฝ่ายการพยาบาล' : 'ห้องER'
            };
        }

        this.state.currentUser = userObj;
        localStorage.setItem('sukho_current_user', JSON.stringify(userObj));
        this.updateProfileWidget();

        // Clear login inputs if any
        const staffUser = document.getElementById('staff-username');
        const staffPass = document.getElementById('staff-password');
        const adminUser = document.getElementById('admin-username');
        const adminPass = document.getElementById('admin-password');
        if (staffUser) staffUser.value = '';
        if (staffPass) staffPass.value = '';
        if (adminUser) adminUser.value = '';
        if (adminPass) adminPass.value = '';

        this.closeModal('staff-login-modal');
        this.closeModal('admin-login-modal');

        const roleThai = role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน';
        this.showToast(`⚡ เข้าสู่ระบบชั่วคราวสำเร็จ: คุณ${username} (${roleThai})`, 'success');

        if (role === 'admin') {
            this.changeView('admin-dashboard');
        } else {
            this.changeView('room-selection');
        }
    }

    handleLogout() {
        this.state.currentUser = null;
        localStorage.removeItem('sukho_current_user');
        this.showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
        this.changeView('login');
    }

    updateProfileWidget() {
        const widget = document.getElementById('user-profile-widget');
        if (!widget || !this.state.currentUser) return;

        const roleThai = this.state.currentUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'เจ้าหน้าที่ (Staff)';
        const roleClass = this.state.currentUser.role === 'admin' ? 'user-badge admin' : 'user-badge';

        widget.innerHTML = `
            <div class="user-meta">
                <span class="profile-name"><strong>${this.state.currentUser.name}</strong></span>
                <span class="${roleClass}">${roleThai}</span>
            </div>
            <button class="logout-btn" onclick="app.handleLogout()"><i class="fa-solid fa-sign-out-alt"></i> ออกจากระบบ</button>
        `;
    }

    // ==========================================================================
    // Modals
    // ==========================================================================
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // ==========================================================================
    // Dashboard Stats
    // ==========================================================================
    updateStats() {
        let mCount = 0;
        let aCount = 0;
        let nCount = 0;
        let offCount = 0;

        const activeRoom = this.state.activeRoomFilter;
        let schedulesToCount = [];

        // If logged in as regular staff, count ONLY their own shifts
        if (this.state.currentUser && this.state.currentUser.role === 'staff') {
            const currentStaffId = this.state.currentUser.id;
            const staffObj = this.state.staff.find(s => s.id === currentStaffId || s.name === this.state.currentUser.name) || this.state.currentUser;
            schedulesToCount = [this.getNurseShiftsForMonth(staffObj.id, this.state.selectedMonth)];
        } else {
            schedulesToCount = Object.keys(this.state.schedule).map(id => this.getNurseShiftsForMonth(id, this.state.selectedMonth));
        }

        schedulesToCount.forEach(shifts => {
            shifts.forEach(shift => {
                const shiftItems = this.getShiftsArrayForDay(shift);
                shiftItems.forEach(item => {
                    if (activeRoom && activeRoom !== 'ห้องทั้งหมด' && item.room !== activeRoom) {
                        return;
                    }

                    if (item.shiftType === 'ช') mCount++;
                    else if (item.shiftType === 'บ') aCount++;
                    else if (item.shiftType === 'ด') nCount++;
                    else if (item.shiftType === 'Off') {
                        if (!activeRoom || activeRoom === 'ห้องทั้งหมด') {
                            offCount++;
                        }
                    }
                });
            });
        });

        document.getElementById('stat-m-count').textContent = `${mCount} เวร`;
        document.getElementById('stat-a-count').textContent = `${aCount} เวร`;
        document.getElementById('stat-n-count').textContent = `${nCount} เวร`;
        document.getElementById('stat-off-count').textContent = `${offCount} วัน`;
    }

    // ==========================================================================
    // Render Excel Shift Grid & Cell Generation
    // ==========================================================================
    renderShiftCellHTML(shiftObj, nurseName = '', dayNum = 1, monthShort = 'พ.ย.') {
        const shift = this.normalizeShiftEntry(shiftObj, 'ห้องER', dayNum);
        const isDual = shift.shift2Type && shift.shift2Type !== 'Off' && shift.shiftType !== 'Off';

        if (isDual) {
            const s1Style = this.getShiftStyleAndClass(shift.shiftType, shift.room);
            const s2Style = this.getShiftStyleAndClass(shift.shift2Type, shift.room2 || shift.room);

            const tooltip = `${nurseName} - วันที่ ${dayNum} ${monthShort} - 2 กะ: [กะ 1: ${shift.shiftType} (${shift.room})] + [กะ 2: ${shift.shift2Type} (${shift.room2 || shift.room})]`;

            return `
                <div class="split-cell-container" title="${tooltip}">
                    <div class="split-triangle top-left ${s1Style.className}">
                        <span class="split-label top-left-label">${shift.shiftType}</span>
                    </div>
                    <div class="split-triangle bottom-right ${s2Style.className}">
                        <span class="split-label bottom-right-label">${shift.shift2Type}</span>
                    </div>
                </div>
            `;
        } else {
            const s1Style = this.getShiftStyleAndClass(shift.shiftType, shift.room);
            const label = shift.shiftType;
            const tooltip = shift.shiftType === 'Off'
                ? `${nurseName} - วันที่ ${dayNum} ${monthShort} - วันหยุด (Off)`
                : `${nurseName} - วันที่ ${dayNum} ${monthShort} - เวร ${shift.shiftType} ณ ${shift.room}`;

            return `
                <div class="single-cell-container ${s1Style.className}" title="${tooltip}">
                    <span class="single-label">${label}</span>
                </div>
            `;
        }
    }

    showAllSchedule() {
        this.state.activeRoomFilter = 'ห้องทั้งหมด';
        this.state.overviewPage = 1;

        document.querySelectorAll('.room-nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('room-nav-all').classList.add('active');

        this.changeView('room-selection');
    }

    selectRoom(roomName) {
        this.state.activeRoom = roomName;
        this.state.roomPage = 1;
        this.changeView('specific-room');

        document.querySelectorAll('.room-nav-btn').forEach(btn => btn.classList.remove('active'));
        if (roomName === 'ห้องER') document.getElementById('room-nav-er').classList.add('active');
        else if (roomName === 'ห้องคลอด') document.getElementById('room-nav-delivery').classList.add('active');
        else if (roomName === 'ห้องฉุกเฉิน') document.getElementById('room-nav-accident').classList.add('active');
    }

    filterGridSearch() {
        this.state.searchQuery = document.getElementById('schedule-search').value.toLowerCase().trim();
        this.state.overviewPage = 1;
        this.renderOverviewGrid();
    }

    renderOverviewGrid() {
        const table = document.getElementById('excel-schedule-table');
        if (!table) return;

        this.renderMonthSelector();

        const currentMonthObj = this.months.find(m => m.id === this.state.selectedMonth) || this.months[0];
        const daysInCurrentMonth = currentMonthObj.days;

        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        thead.innerHTML = '';
        tbody.innerHTML = '';

        const isStaffUser = Boolean(this.state.currentUser && this.state.currentUser.role === 'staff');
        const viewHeaderTitle = document.querySelector('#screen-room-selection .view-header h2');
        const viewHeaderDesc = document.querySelector('#screen-room-selection .view-header p');
        const staffCount = this.state.staff.filter(s => s.role === 'staff').length;

        if (isStaffUser) {
            if (viewHeaderTitle) viewHeaderTitle.innerHTML = `<i class="fa-solid fa-user-nurse"></i> ตารางเวรปฏิบัติงานส่วนบุคคล`;
            if (viewHeaderDesc) viewHeaderDesc.innerHTML = `<i class="fa-solid fa-user-check"></i> แสดงตารางเวรปฏิบัติงานประจำเดือน${currentMonthObj.name} ของ <strong>คุณ${this.state.currentUser.name}</strong> (คลิกที่ช่องเวรเพื่อแก้ไข)`;
        } else {
            if (viewHeaderTitle) viewHeaderTitle.innerHTML = `<i class="fa-solid fa-grip"></i> ตารางเวรปฏิบัติงานประจำเดือน${currentMonthObj.name} 2569`;
            if (viewHeaderDesc) viewHeaderDesc.innerHTML = `แสดงตารางเวรรวมของเจ้าหน้าที่พยาบาลและวิชาชีพทั้งหมด ${staffCount} ท่าน (คลิกที่ช่องเวรเพื่อแก้ไข)`;
        }

        // 1. Build Header Row (Nurses Name + Days in Month)
        const headerRow = document.createElement('tr');
        const nameHeader = document.createElement('th');
        nameHeader.textContent = 'รายชื่อพยาบาล';
        headerRow.appendChild(nameHeader);

        for (let day = 1; day <= daysInCurrentMonth; day++) {
            const dayHeader = document.createElement('th');
            dayHeader.innerHTML = `<div>${currentMonthObj.shortName}</div><div>${day}</div>`;
            headerRow.appendChild(dayHeader);
        }
        thead.appendChild(headerRow);

        // 2. Filter Staff and Build rows: For staff account, show ONLY their own schedule
        const query = this.state.searchQuery;
        const filteredStaff = this.state.staff.filter(s => {
            if (s.role !== 'staff') return false;
            if (isStaffUser) {
                return s.id === this.state.currentUser.id || (s.name && this.state.currentUser.name && s.name.trim() === this.state.currentUser.name.trim());
            }
            if (query && !s.name.toLowerCase().includes(query)) return false;
            return true;
        });

        const totalItems = filteredStaff.length;

        if (totalItems === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.setAttribute('colspan', String(daysInCurrentMonth + 1));
            emptyCell.className = 'empty-state';
            emptyCell.innerHTML = `<i class="fa-solid fa-folder-open"></i> ไม่พบข้อมูลตารางเวรของเจ้าหน้าที่`;
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);

            this.renderOverviewPagination(0);
            return;
        }

        // Apply Pagination
        const totalPages = Math.ceil(totalItems / this.state.overviewPageSize) || 1;
        if (this.state.overviewPage > totalPages) {
            this.state.overviewPage = totalPages;
        }
        if (this.state.overviewPage < 1) {
            this.state.overviewPage = 1;
        }
        const startIndex = (this.state.overviewPage - 1) * this.state.overviewPageSize;
        const endIndex = Math.min(startIndex + this.state.overviewPageSize, totalItems);
        const pagedStaff = filteredStaff.slice(startIndex, endIndex);

        pagedStaff.forEach(nurse => {
            const tr = document.createElement('tr');
            const isSelf = Boolean(this.state.currentUser && (
                nurse.id === this.state.currentUser.id ||
                (nurse.name && this.state.currentUser.name && nurse.name.trim() === this.state.currentUser.name.trim())
            ));
            if (isSelf) {
                tr.classList.add('self-row-highlight');
            }

            const tdName = document.createElement('td');
            tdName.innerHTML = `
                <div class="staff-item-name">${nurse.name} ${isSelf ? '<span class="self-badge">คุณ</span>' : ''}</div>
            `;
            tdName.style.cursor = 'pointer';
            tdName.title = `คลิกเพื่อดูตารางเวรรายบุคคลของ ${nurse.name}`;
            tdName.onclick = () => this.openNurseIndividualSchedule(nurse.id);
            tr.appendChild(tdName);

            const shifts = this.getNurseShiftsForMonth(nurse.id, this.state.selectedMonth);

            for (let day = 1; day <= daysInCurrentMonth; day++) {
                const shift = shifts[day - 1];
                const tdShift = document.createElement('td');
                tdShift.className = 'cell-shift';

                tdShift.innerHTML = this.renderShiftCellHTML(shift, nurse.name, day, currentMonthObj.shortName);

                // Clicking on a cell opens the Shift Editor Modal
                tdShift.onclick = () => {
                    this.openEditShiftModal(nurse.id, this.state.selectedMonth, day);
                };

                tr.appendChild(tdShift);
            }

            tbody.appendChild(tr);
        });

        this.renderOverviewPagination(totalItems);
    }

    renderOverviewPagination(totalItems) {
        const container = document.getElementById('overview-pagination');
        if (!container) return;

        const totalPages = Math.ceil(totalItems / this.state.overviewPageSize) || 1;
        container.innerHTML = '';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> ก่อนหน้า';
        prevBtn.disabled = this.state.overviewPage <= 1;
        prevBtn.onclick = () => {
            if (this.state.overviewPage > 1) {
                this.state.overviewPage--;
                this.renderOverviewGrid();
            }
        };

        const pageInfo = document.createElement('div');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `หน้าที่ ${this.state.overviewPage} / ${totalPages}`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = 'ถัดไป <i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled = this.state.overviewPage >= totalPages;
        nextBtn.onclick = () => {
            if (this.state.overviewPage < totalPages) {
                this.state.overviewPage++;
                this.renderOverviewGrid();
            }
        };

        container.appendChild(prevBtn);
        container.appendChild(pageInfo);
        container.appendChild(nextBtn);
    }

    // ==========================================================================
    // Specific Room Shift Details and Swap Forms
    // ==========================================================================
    renderSpecificRoomView() {
        const activeRoom = this.state.activeRoom;
        const currentMonthObj = this.months.find(m => m.id === this.state.selectedMonth) || this.months[0];
        document.getElementById('room-view-title').innerHTML = `<i class="fa-solid fa-door-open"></i> แผนก: ${activeRoom} (${currentMonthObj.name})`;

        this.renderMonthSelector();

        const tbody = document.querySelector('#room-shift-distribution-table tbody');
        tbody.innerHTML = '';

        const totalItems = currentMonthObj.days;
        const totalPages = Math.ceil(totalItems / this.state.roomPageSize) || 1;
        if (this.state.roomPage > totalPages) {
            this.state.roomPage = totalPages;
        }
        if (this.state.roomPage < 1) {
            this.state.roomPage = 1;
        }
        const startDay = (this.state.roomPage - 1) * this.state.roomPageSize + 1;
        const endDay = Math.min(startDay + this.state.roomPageSize - 1, totalItems);

        for (let day = startDay; day <= endDay; day++) {
            const tr = document.createElement('tr');

            const tdDate = document.createElement('td');
            tdDate.style.fontWeight = '700';
            tdDate.textContent = `วันที่ ${day} ${currentMonthObj.shortName}`;
            tr.appendChild(tdDate);

            const morningNurses = [];
            const afternoonNurses = [];
            const nightNurses = [];

            Object.entries(this.state.schedule).forEach(([nurseId]) => {
                const nurse = this.state.staff.find(s => s.id === nurseId);
                if (!nurse) return;

                const monthShifts = this.getNurseShiftsForMonth(nurseId, this.state.selectedMonth);
                const dayShift = monthShifts[day - 1];
                if (dayShift) {
                    const shiftArr = this.getShiftsArrayForDay(dayShift);
                    shiftArr.forEach(item => {
                        if (item.room === activeRoom) {
                            if (item.shiftType === 'ช') morningNurses.push(nurse);
                            else if (item.shiftType === 'บ') afternoonNurses.push(nurse);
                            else if (item.shiftType === 'ด') nightNurses.push(nurse);
                        }
                    });
                }
            });

            const renderNurseTag = (nurseObj) => {
                const isSelf = Boolean(this.state.currentUser && (
                    nurseObj.id === this.state.currentUser.id ||
                    (nurseObj.name && this.state.currentUser.name && nurseObj.name.trim() === this.state.currentUser.name.trim())
                ));
                if (isSelf) {
                    return `<span class="nurse-name-tag self-tag" style="background:#2d6a4f; color:#fff; font-weight:bold; border-radius:4px; padding:2px 6px; display:inline-block; margin:2px;">${nurseObj.name} (คุณ)</span>`;
                }
                return `<span class="nurse-name-tag" style="display:inline-block; margin:2px;">${nurseObj.name}</span>`;
            };

            const tdM = document.createElement('td');
            morningNurses.forEach(nurseObj => {
                tdM.innerHTML += renderNurseTag(nurseObj);
            });
            if (morningNurses.length === 0) tdM.innerHTML = `<span style="color:#a0aec0; font-size:11px;">ไม่มีเวรปฏิบัติการ</span>`;
            tr.appendChild(tdM);

            const tdA = document.createElement('td');
            afternoonNurses.forEach(nurseObj => {
                tdA.innerHTML += renderNurseTag(nurseObj);
            });
            if (afternoonNurses.length === 0) tdA.innerHTML = `<span style="color:#a0aec0; font-size:11px;">ไม่มีเวรปฏิบัติการ</span>`;
            tr.appendChild(tdA);

            const tdN = document.createElement('td');
            nightNurses.forEach(nurseObj => {
                tdN.innerHTML += renderNurseTag(nurseObj);
            });
            if (nightNurses.length === 0) tdN.innerHTML = `<span style="color:#a0aec0; font-size:11px;">ไม่มีเวรปฏิบัติการ</span>`;
            tr.appendChild(tdN);

            tbody.appendChild(tr);
        }

        this.populateSwapFormDropdowns();
        this.renderRoomPagination(totalItems);
    }

    renderRoomPagination(totalItems) {
        const container = document.getElementById('room-pagination');
        if (!container) return;

        const totalPages = Math.ceil(totalItems / this.state.roomPageSize) || 1;
        container.innerHTML = '';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> ก่อนหน้า';
        prevBtn.disabled = this.state.roomPage <= 1;
        prevBtn.onclick = () => {
            if (this.state.roomPage > 1) {
                this.state.roomPage--;
                this.renderSpecificRoomView();
            }
        };

        const pageInfo = document.createElement('div');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `หน้าที่ ${this.state.roomPage} / ${totalPages}`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = 'ถัดไป <i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled = this.state.roomPage >= totalPages;
        nextBtn.onclick = () => {
            if (this.state.roomPage < totalPages) {
                this.state.roomPage++;
                this.renderSpecificRoomView();
            }
        };

        container.appendChild(prevBtn);
        container.appendChild(pageInfo);
        container.appendChild(nextBtn);
    }

    populateSwapFormDropdowns() {
        const myShiftSelect = document.getElementById('swap-my-shift');
        const partnerSelect = document.getElementById('swap-partner');
        const partnerShiftSelect = document.getElementById('swap-partner-shift');
        const activeRoom = this.state.activeRoom;
        const currentMonthObj = this.months.find(m => m.id === this.state.selectedMonth) || this.months[0];

        myShiftSelect.innerHTML = '<option value="" disabled selected>-- เลือกเวรปฏิบัติงานของคุณ --</option>';
        partnerSelect.innerHTML = '<option value="" disabled selected>-- เลือกคู่แลกเวร --</option>';
        partnerShiftSelect.innerHTML = '<option value="" disabled selected>-- เลือกเวรของคู่แลกเวร --</option>';
        partnerShiftSelect.disabled = true;

        if (!this.state.currentUser || this.state.currentUser.role === 'admin') {
            myShiftSelect.innerHTML = '<option value="" disabled>ผู้ใช้ปัจจุบันต้องไม่ใช่ Admin เพื่อขอแลกเวร</option>';
            return;
        }

        const myShifts = this.getNurseShiftsForMonth(this.state.currentUser.id, this.state.selectedMonth);
        let hasMyShifts = false;

        myShifts.forEach(shift => {
            const shiftItems = this.getShiftsArrayForDay(shift);
            shiftItems.forEach(item => {
                if (item.room === activeRoom && item.shiftType !== 'Off') {
                    hasMyShifts = true;
                    const option = document.createElement('option');
                    option.value = shift.day;
                    option.textContent = `วันที่ ${shift.day} ${currentMonthObj.shortName} - เวร ${item.shiftType} (${activeRoom})`;
                    myShiftSelect.appendChild(option);
                }
            });
        });

        if (!hasMyShifts) {
            myShiftSelect.innerHTML = `<option value="" disabled>คุณไม่มีเวรปฏิบัติหน้าที่ใน ${activeRoom} สำหรับเดือน${currentMonthObj.name}</option>`;
        }

        const currentUserId = this.state.currentUser.id;
        const currentUserName = this.state.currentUser.name;
        const otherStaff = this.state.staff.filter(s => s.role === 'staff' && s.id !== currentUserId && s.name !== currentUserName);
        
        otherStaff.forEach(partner => {
            const option = document.createElement('option');
            option.value = partner.id;
            option.textContent = `${partner.name} (${partner.primaryDept})`;
            partnerSelect.appendChild(option);
        });
    }

    handleMyShiftChange() {
    }

    handlePartnerChange() {
        const partnerSelect = document.getElementById('swap-partner');
        const partnerShiftSelect = document.getElementById('swap-partner-shift');
        const partnerId = partnerSelect.value;
        const currentMonthObj = this.months.find(m => m.id === this.state.selectedMonth) || this.months[0];

        partnerShiftSelect.innerHTML = '<option value="" disabled selected>-- เลือกเวรของคู่แลกเวร --</option>';

        if (!partnerId) {
            partnerShiftSelect.disabled = true;
            return;
        }

        const partnerShifts = this.getNurseShiftsForMonth(partnerId, this.state.selectedMonth);
        partnerShiftSelect.disabled = false;

        partnerShifts.forEach(shift => {
            const option = document.createElement('option');
            option.value = shift.day;
            
            const shiftItems = this.getShiftsArrayForDay(shift);
            let label = `วันที่ ${shift.day} ${currentMonthObj.shortName} - `;
            if (shiftItems.length === 1 && shiftItems[0].shiftType === 'Off') {
                label += 'วันหยุด (Off)';
            } else {
                label += shiftItems.map(item => `เวร ${item.shiftType} (${item.room})`).join(' + ');
            }

            option.textContent = label;
            partnerShiftSelect.appendChild(option);
        });
    }

    handleSwapSubmit(event) {
        event.preventDefault();

        const myDay = parseInt(document.getElementById('swap-my-shift').value);
        const partnerId = document.getElementById('swap-partner').value;
        const partnerDay = parseInt(document.getElementById('swap-partner-shift').value);
        const adminName = document.getElementById('swap-admin').value;
        const remarks = document.getElementById('swap-remarks').value.trim();

        if (!myDay || !partnerId || !partnerDay || !adminName || !remarks) {
            this.showToast("กรุณากรอกข้อมูลการแลกเวรให้ครบถ้วน", "error");
            return;
        }

        const partnerObj = this.state.staff.find(s => s.id === partnerId);
        
        const myShifts = this.getNurseShiftsForMonth(this.state.currentUser.id, this.state.selectedMonth);
        const partnerShifts = this.getNurseShiftsForMonth(partnerId, this.state.selectedMonth);
        const myShift = myShifts[myDay - 1];
        const partnerShift = partnerShifts[partnerDay - 1];

        const currentMonthObj = this.months.find(m => m.id === this.state.selectedMonth) || this.months[0];
        const swapRequest = {
            id: `req-${Date.now()}`,
            requesterId: this.state.currentUser.id,
            requesterName: this.state.currentUser.name,
            partnerId: partnerId,
            partnerName: partnerObj.name,
            room: this.state.activeRoom,
            month: this.state.selectedMonth,
            monthShort: currentMonthObj.shortName,
            
            // Requester details
            myDay: myDay,
            myShiftType: myShift.shiftType,
            myRoom: myShift.room,

            // Partner details
            partnerDay: partnerDay,
            partnerShiftType: partnerShift.shiftType,
            partnerRoom: partnerShift.room,

            remarks: remarks,
            admin: adminName,
            status: 'pending',
            timestamp: new Date().toLocaleString()
        };

        this.state.swapRequests.push(swapRequest);
        this.saveStateToLocalStorage();

        // Reset form and UI
        document.getElementById('swap-request-form').reset();
        this.populateSwapFormDropdowns();

        this.showToast("ส่งคำขอแลกเปลี่ยนเวรไปยังผู้ดูแลระบบเรียบร้อยแล้ว รอการอนุมัติ", "success");
    }

    // ==========================================================================
    // Admin Dashboard & Workflows
    // ==========================================================================
    renderAdminDashboard() {
        this.renderAdminStaffList();
        this.renderAdminRequestsQueue();
    }

    filterAdminStaff() {
        this.state.adminSearchQuery = document.getElementById('admin-staff-search').value.toLowerCase().trim();
        this.renderAdminStaffList();
    }

    addNewStaff(event) {
        event.preventDefault();
        const nameInput = document.getElementById('new-staff-name');
        const deptInput = document.getElementById('new-staff-dept');
        const name = nameInput.value.trim();
        const dept = deptInput.value;

        if (!name || !dept) {
            this.showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
            return;
        }

        // Check if name already exists
        const exists = this.state.staff.some(s => s.name === name);
        if (exists) {
            this.showToast(`มีเจ้าหน้าที่ชื่อ "${name}" ในระบบแล้ว`, "error");
            return;
        }

        const newStaffId = `staff-new-${Date.now()}`;
        const newStaff = {
            id: newStaffId,
            name: name,
            role: 'staff',
            primaryDept: dept
        };

        // Generate 12-month schedule for new staff with smart dual shifts
        const yearSchedule = {};
        this.months.forEach(m => {
            yearSchedule[m.id] = this.generateSmartMonthShifts(m.id, m.days, dept);
        });

        // Update state
        this.state.staff.push(newStaff);
        this.state.schedule[newStaffId] = yearSchedule;

        // Save
        this.saveStateToLocalStorage();

        // Refresh views
        this.renderAdminDashboard();
        
        // Reset form & close modal
        nameInput.value = '';
        deptInput.value = '';
        this.closeModal('add-staff-modal');

        this.showToast(`เพิ่มคุณ ${name} และสุ่มตารางเวรเรียบร้อยแล้ว`, 'success');
    }

    renderAdminStaffList() {
        const listContainer = document.getElementById('admin-staff-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const query = this.state.adminSearchQuery;

        const totalStaffCount = this.state.staff.filter(s => s.role === 'staff').length;
        const panelTitle = document.querySelector('#admin-staff-list-panel .panel-header h3');
        if (panelTitle) {
            panelTitle.innerHTML = `<i class="fa-solid fa-users-medical"></i> รายชื่อพยาบาลและเจ้าหน้าที่ (${totalStaffCount} ท่าน)`;
        }

        const filteredStaff = this.state.staff.filter(s => {
            if (s.role !== 'staff') return false; // Show only staff, not admins
            if (query && !s.name.toLowerCase().includes(query)) return false;
            return true;
        });

        filteredStaff.forEach(nurse => {
            const li = document.createElement('li');
            li.className = 'staff-list-item';
            li.onclick = () => this.openNurseIndividualSchedule(nurse.id);

            li.innerHTML = `
                <div>
                    <div class="staff-item-name"><i class="fa-solid fa-user-nurse"></i> ${nurse.name}</div>
                    <div class="staff-item-dept">${nurse.primaryDept}</div>
                </div>
                <span class="view-schedule-badge">ดูตารางเวร</span>
            `;
            listContainer.appendChild(li);
        });

        if (filteredStaff.length === 0) {
            listContainer.innerHTML = `<li class="empty-state"><i class="fa-solid fa-search"></i> ไม่พบเจ้าหน้าที่ชื่อนี้</li>`;
        }
    }

    renderAdminRequestsQueue() {
        const queueContainer = document.getElementById('admin-requests-queue');
        if (!queueContainer) return;

        queueContainer.innerHTML = '';
        
        // Filter pending requests matching active admin's name
        const pendingRequests = this.state.swapRequests.filter(
            req => req.status === 'pending' && req.admin === this.state.currentUser.name
        );

        if (pendingRequests.length === 0) {
            queueContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-circle-check" style="color:var(--primary-light);"></i>
                    <p>ไม่มีคำขออนุมัติแลกเวรค้างรอในขณะนี้</p>
                </div>
            `;
            return;
        }

        pendingRequests.forEach(req => {
            const card = document.createElement('div');
            card.className = 'request-card';
            card.onclick = () => this.openSwapRequestDetails(req.id);

            const initial = req.requesterName.substring(0, 2);

            card.innerHTML = `
                <div class="request-card-header">
                    <div class="requester-info">
                        <div class="requester-avatar">${initial}</div>
                        <div>
                            <span class="requester-name">${req.requesterName}</span>
                            <div style="font-size:10px; color:var(--text-muted);">${req.timestamp}</div>
                        </div>
                    </div>
                    <span class="request-status-badge pending">รออนุมัติ</span>
                </div>
                <div class="request-card-details">
                    <span>แลกเวรวันที่: <strong>${req.myDay} ${req.monthShort || 'พ.ย.'}</strong></span>
                    <span>กับคู่แลก: <strong>${req.partnerName}</strong></span>
                    <span style="grid-column: span 2;">ห้องปฏิบัติหน้าที่: <strong>${req.room}</strong></span>
                </div>
            `;
            queueContainer.appendChild(card);
        });
    }

    openSwapRequestDetails(requestId) {
        const req = this.state.swapRequests.find(r => r.id === requestId);
        if (!req) return;

        const container = document.getElementById('swap-detail-content');
        const actions = document.getElementById('swap-detail-actions');

        let myShiftLabel = `กะ ${req.myShiftType}`;
        let partnerShiftLabel = req.partnerShiftType === 'Off' ? 'วันหยุด (Off)' : `กะ ${req.partnerShiftType} (${req.partnerRoom})`;

        const myStyle = this.getRoomColorStyle(req.myRoom);
        const partnerStyle = this.getRoomColorStyle(req.partnerRoom);

        container.innerHTML = `
            <div class="swap-comparison">
                <div class="comparison-node">
                    <div class="node-name">${req.requesterName} (ผู้ส่ง)</div>
                    <div class="node-shift" style="${myStyle}">
                        ${myShiftLabel}
                    </div>
                    <span class="node-date">วันที่ ${req.myDay} ${req.monthShort || 'พ.ย.'}</span>
                    <span class="node-room">${req.myRoom}</span>
                </div>
                <div class="comparison-arrow">
                    <i class="fa-solid fa-arrows-left-right"></i>
                </div>
                <div class="comparison-node">
                    <div class="node-name">${req.partnerName} (คู่แลก)</div>
                    <div class="node-shift" style="${partnerStyle}">
                        ${partnerShiftLabel}
                    </div>
                    <span class="node-date">วันที่ ${req.partnerDay} พ.ย.</span>
                    <span class="node-room">${req.partnerRoom}</span>
                </div>
            </div>

            <div class="swap-reason-block">
                <h4><i class="fa-solid fa-comment-medical"></i> เหตุผลการแลกเวร:</h4>
                <p class="reason-text">"${req.remarks}"</p>
            </div>

            <div class="swap-admin-block">
                <span>ผู้พิจารณา: <strong>${req.admin}</strong></span>
                <span>รหัสคำขอ: <strong>${req.id}</strong></span>
            </div>
        `;

        actions.innerHTML = `
            <button class="deny-btn" onclick="app.handleApproval('${req.id}', 'deny')"><i class="fa-solid fa-times-circle"></i> ปฏิเสธ</button>
            <button class="approve-btn" onclick="app.handleApproval('${req.id}', 'approve')"><i class="fa-solid fa-check-circle"></i> อนุมัติการแลกเวร</button>
        `;

        this.openModal('request-detail-modal');
    }

    handleApproval(requestId, action) {
        const reqIndex = this.state.swapRequests.findIndex(r => r.id === requestId);
        if (reqIndex === -1) return;

        const req = this.state.swapRequests[reqIndex];

        if (action === 'approve') {
            req.status = 'approved';
            req.approvedAt = new Date().toLocaleString('th-TH');

            // PERFORM BACKEND UPDATE: Swap shifts in schedule map!
            const schedule = this.state.schedule;
            const monthKey = req.month || this.state.selectedMonth || 11;
            
            const reqStaffSched = schedule[req.requesterId];
            const partnerStaffSched = schedule[req.partnerId];

            const reqShifts = Array.isArray(reqStaffSched) ? reqStaffSched : (reqStaffSched ? (reqStaffSched[monthKey] || reqStaffSched[String(monthKey)]) : null);
            const partnerShifts = Array.isArray(partnerStaffSched) ? partnerStaffSched : (partnerStaffSched ? (partnerStaffSched[monthKey] || partnerStaffSched[String(monthKey)]) : null);

            if (reqShifts && partnerShifts) {
                // Fetch previous shift objects
                const myIdx = req.myDay - 1;
                const partnerIdx = req.partnerDay - 1;

                const prevMyShift = { ...reqShifts[myIdx] };
                const prevPartnerShift = { ...partnerShifts[partnerIdx] };

                const prevMyShiftOnPartnerDay = { ...reqShifts[partnerIdx] };
                const prevPartnerShiftOnMyDay = { ...partnerShifts[myIdx] };

                reqShifts[myIdx] = {
                    day: req.myDay,
                    month: monthKey,
                    shiftType: prevPartnerShiftOnMyDay.shiftType,
                    room: prevPartnerShiftOnMyDay.room
                };

                reqShifts[partnerIdx] = {
                    day: req.partnerDay,
                    month: monthKey,
                    shiftType: prevPartnerShift.shiftType,
                    room: prevPartnerShift.room
                };

                partnerShifts[myIdx] = {
                    day: req.myDay,
                    month: monthKey,
                    shiftType: prevMyShift.shiftType,
                    room: prevMyShift.room
                };

                partnerShifts[partnerIdx] = {
                    day: req.partnerDay,
                    month: monthKey,
                    shiftType: prevMyShiftOnPartnerDay.shiftType,
                    room: prevMyShiftOnPartnerDay.room
                };

                this.state.schedule = schedule;
                this.saveStateToLocalStorage();
                this.showToast(`อนุมัติคำขอสำเร็จ และทำการสลับตารางเวรในระบบเรียบร้อยแล้ว`, 'success');
            } else {
                this.showToast(`เกิดข้อผิดพลาดด้านข้อมูลตารางเวรพยาบาล`, 'error');
            }
        } else {
            req.status = 'denied';
            this.saveStateToLocalStorage();
            this.showToast(`ปฏิเสธคำขอการแลกเวรเรียบร้อยแล้ว`, 'info');
        }

        this.closeModal('request-detail-modal');
        this.renderAdminDashboard();
        if (this.state.activeView === 'admin-reports') {
            this.renderAdminReports();
        }
    }

    // ==========================================================================
    // Admin Reports Logic
    // ==========================================================================
    clearSwapReports() {
        if (confirm('คุณต้องการล้างข้อมูลรายงานการแลกเวรทั้งหมดใช่หรือไม่?')) {
            this.state.swapRequests = [];
            localStorage.setItem('sukho_swap_requests', JSON.stringify(this.state.swapRequests));
            
            // Push cleared state to Google Sheet if connected
            if (this.googleSheetScriptUrl) {
                this.pushLocalToGoogleSheet(true);
            }

            this.renderAdminReports();
            this.renderAdminDashboard();
            this.showToast('ล้างข้อมูลรายงานการแลกเวรเรียบร้อยแล้ว', 'success');
        }
    }

    filterAdminReports() {
        const searchInput = document.getElementById('admin-reports-search');
        if (searchInput) {
            this.state.reportsSearchQuery = searchInput.value.toLowerCase().trim();
        } else {
            this.state.reportsSearchQuery = '';
        }
        this.renderAdminReports();
    }

    renderAdminReports() {
        const tbody = document.getElementById('admin-swap-reports-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Filter approved swap requests across all admins/staff
        let approvedRequests = this.state.swapRequests.filter(req => req.status === 'approved');

        const query = this.state.reportsSearchQuery || '';
        if (query) {
            approvedRequests = approvedRequests.filter(req => 
                (req.requesterName && req.requesterName.toLowerCase().includes(query)) ||
                (req.partnerName && req.partnerName.toLowerCase().includes(query)) ||
                (req.admin && req.admin.toLowerCase().includes(query)) ||
                (req.remarks && req.remarks.toLowerCase().includes(query))
            );
        }

        if (approvedRequests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fa-solid fa-folder-open" style="font-size: 24px; color: var(--text-muted); margin-bottom: 8px;"></i>
                        <p style="margin-top: 4px;">${query ? 'ไม่พบข้อมูลรายงานการแลกเวรที่ตรงกับคำค้นหา' : 'ยังไม่มีข้อมูลการแลกภาระงานที่ได้รับการอนุมัติจากผู้ดูแลระบบ'}</p>
                    </td>
                </tr>
            `;
            return;
        }

        const formatDuty = (nurseName, day, shiftType, room) => {
            let shiftText = '';
            let badgeClass = 'work-m';
            if (shiftType === 'ช') { shiftText = 'เวรเช้า (ช)'; badgeClass = 'shift-m'; }
            else if (shiftType === 'บ') { shiftText = 'เวรบ่าย (บ)'; badgeClass = 'shift-a'; }
            else if (shiftType === 'ด') { shiftText = 'เวรดึก (ด)'; badgeClass = 'shift-n'; }
            else { shiftText = 'วันหยุด (Off)'; badgeClass = 'shift-off'; }

            const roomText = (shiftType !== 'Off' && room && room !== 'Off') ? ` (${room})` : '';
            return `
                <div class="duty-item-row">
                    <span class="duty-owner-name"><i class="fa-solid fa-user-nurse"></i> ${nurseName}:</span>
                    <span class="duty-badge-pill ${badgeClass}">วันที่ ${day} พ.ย. - ${shiftText}${roomText}</span>
                </div>
            `;
        };

        approvedRequests.forEach(req => {
            const tr = document.createElement('tr');
            tr.className = 'report-table-row';

            // 1. ผู้ขอ - ผู้แลก
            const tdPeople = document.createElement('td');
            tdPeople.className = 'col-people';
            tdPeople.innerHTML = `
                <div class="swap-people-box">
                    <div class="person-row requester">
                        <span class="role-badge req">ผู้ขอ</span>
                        <strong class="person-name">${req.requesterName}</strong>
                    </div>
                    <div class="swap-icon-divider"><i class="fa-solid fa-arrow-down-long"></i> <i class="fa-solid fa-arrow-up-long"></i></div>
                    <div class="person-row partner">
                        <span class="role-badge ptr">ผู้แลก</span>
                        <strong class="person-name">${req.partnerName}</strong>
                    </div>
                </div>
            `;
            tr.appendChild(tdPeople);

            // 2. ภาระงานก่อน (ภาระงานก่อนแลก)
            const tdBefore = document.createElement('td');
            tdBefore.className = 'col-duty-before';
            tdBefore.innerHTML = `
                <div class="duty-box duty-before">
                    ${formatDuty(req.requesterName, req.myDay, req.myShiftType, req.myRoom)}
                    ${formatDuty(req.partnerName, req.partnerDay, req.partnerShiftType, req.partnerRoom)}
                </div>
            `;
            tr.appendChild(tdBefore);

            // 3. ภาระงานหลัง (ภาระงานหลังแลก)
            const tdAfter = document.createElement('td');
            tdAfter.className = 'col-duty-after';
            tdAfter.innerHTML = `
                <div class="duty-box duty-after">
                    ${formatDuty(req.requesterName, req.partnerDay, req.partnerShiftType, req.partnerRoom)}
                    ${formatDuty(req.partnerName, req.myDay, req.myShiftType, req.myRoom)}
                </div>
            `;
            tr.appendChild(tdAfter);

            // 4. ผู้อนุมัติ (ชื่อแอดมินผู้อนุมัติ)
            const tdAdmin = document.createElement('td');
            tdAdmin.className = 'col-admin';
            const approvalTime = req.approvedAt || req.timestamp || '';
            tdAdmin.innerHTML = `
                <div class="approver-box">
                    <span class="admin-name-tag"><i class="fa-solid fa-user-shield"></i> ${req.admin}</span>
                    <span class="approved-status-chip"><i class="fa-solid fa-check-circle"></i> อนุมัติเรียบร้อย</span>
                    ${approvalTime ? `<div class="approved-time"><i class="fa-regular fa-clock"></i> ${approvalTime}</div>` : ''}
                </div>
            `;
            tr.appendChild(tdAdmin);

            tbody.appendChild(tr);
        });
    }

    // ==========================================================================
    // Individual Schedule Calendar Modal
    // ==========================================================================
    openNurseIndividualSchedule(nurseId) {
        const nurse = this.state.staff.find(s => s.id === nurseId);
        if (!nurse) return;

        this.state.activeModalNurseId = nurseId;

        // Privacy check: Regular staff members can only view their own schedule
        if (this.state.currentUser && this.state.currentUser.role === 'staff' && nurse.id !== this.state.currentUser.id) {
            this.showToast("คุณไม่มีสิทธิ์ดูข้อมูลของเจ้าหน้าที่ท่านอื่น", "error");
            return;
        }

        const currentMonthObj = this.months.find(m => m.id === this.state.selectedMonth) || this.months[0];

        // Set title and subtitle
        const dept = nurse.primaryDept || (nurse.role === 'admin' ? 'ฝ่ายการพยาบาล' : 'ห้องER');
        document.getElementById('detail-nurse-name').innerHTML = `<i class="fa-solid fa-hospital-user"></i> ตารางเวรรายบุคคล (${currentMonthObj.name}): ${nurse.name}`;
        document.getElementById('detail-nurse-dept').textContent = `ฝ่ายงาน: ${dept}`;

        const badge = document.getElementById('detail-nurse-badge');
        if (nurse.role === 'admin') {
            badge.textContent = 'Admin';
            badge.style.background = '#4a5568';
        } else {
            badge.textContent = 'Staff';
            badge.style.background = 'var(--primary-light)';
        }

        // Render Month Selector inside modal
        this.renderMonthSelector();

        // Render Calendar Grid
        const calendarGrid = document.getElementById('individual-calendar-grid');
        calendarGrid.innerHTML = '';

        const shifts = this.getNurseShiftsForMonth(nurse.id, this.state.selectedMonth);

        // Count shift types accurately
        let m = 0, a = 0, n = 0, off = 0;

        shifts.forEach(shift => {
            const shiftItems = this.getShiftsArrayForDay(shift);
            shiftItems.forEach(item => {
                if (item.shiftType === 'ช') m++;
                else if (item.shiftType === 'บ') a++;
                else if (item.shiftType === 'ด') n++;
                else if (item.shiftType === 'Off') off++;
            });

            const card = document.createElement('div');
            card.className = 'individual-calendar-day-card';
            card.title = 'คลิกเพื่อแก้ไขกะเวรวันนี้';

            let roomDesc = 'วันหยุดพักผ่อน';
            const isDual = shift.shift2Type && shift.shift2Type !== 'Off' && shift.shiftType !== 'Off';
            if (isDual) {
                roomDesc = `${shift.room} + ${shift.room2 || shift.room}`;
            } else if (shift.shiftType !== 'Off') {
                roomDesc = shift.room;
            }

            card.innerHTML = `
                <div class="calendar-day-header-badge">
                    <i class="fa-regular fa-calendar"></i> วันที่ ${shift.day} ${currentMonthObj.shortName}
                </div>
                <div class="calendar-day-shift-box">
                    ${this.renderShiftCellHTML(shift, nurse.name, shift.day, currentMonthObj.shortName)}
                </div>
                <div class="calendar-day-dept-label" title="${roomDesc}">
                    ${roomDesc}
                </div>
                <div class="calendar-day-edit-btn">
                    <i class="fa-solid fa-pen-to-square"></i> แก้ไขเวร
                </div>
            `;

            card.onclick = () => {
                this.openEditShiftModal(nurse.id, this.state.selectedMonth, shift.day);
            };

            calendarGrid.appendChild(card);
        });

        // Set stat indicators
        document.getElementById('ind-m-count').textContent = m;
        document.getElementById('ind-a-count').textContent = a;
        document.getElementById('ind-n-count').textContent = n;
        document.getElementById('ind-off-count').textContent = off;

        this.openModal('staff-detail-modal');
    }

    // ==========================================================================
    // Shift Editor Modal & Live Handlers (Dual Shifts & Diagonal Split)
    // ==========================================================================
    openEditShiftModal(nurseId, month, day) {
        const nurse = this.state.staff.find(s => s.id === nurseId);
        if (!nurse) return;

        // Permission check: regular staff can only edit their own shifts if logged in as staff
        if (this.state.currentUser && this.state.currentUser.role === 'staff' && nurse.id !== this.state.currentUser.id) {
            this.showToast("คุณไม่มีสิทธิ์แก้ไขตารางเวรของเจ้าหน้าที่ท่านอื่น", "error");
            return;
        }

        const monthNum = Number(month) || this.state.selectedMonth;
        const dayNum = Number(day) || 1;
        const currentMonthObj = this.months.find(m => m.id === monthNum) || this.months[0];

        const shifts = this.getNurseShiftsForMonth(nurse.id, monthNum);
        const currentShiftRaw = shifts[dayNum - 1];
        const norm = this.normalizeShiftEntry(currentShiftRaw, nurse.primaryDept, dayNum, monthNum);

        // Set form hidden values
        document.getElementById('edit-shift-nurse-id').value = nurse.id;
        document.getElementById('edit-shift-month').value = monthNum;
        document.getElementById('edit-shift-day').value = dayNum;

        // Set modal title
        document.getElementById('edit-shift-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> แก้ไขกะเวร: ${nurse.name}`;
        document.getElementById('edit-shift-subtitle').innerHTML = `ประจำวันที่ <strong>${dayNum} ${currentMonthObj.name} 2569</strong> (แผนกหลัก: ${nurse.primaryDept})`;

        // Populate Shift 1 values
        const s1Select = document.getElementById('edit-shift1-type');
        const r1Select = document.getElementById('edit-shift1-room');
        const s1Type = norm.shiftType !== 'Off' ? norm.shiftType : 'ช';
        const s1Room = norm.room !== 'Off' ? norm.room : nurse.primaryDept;
        if (s1Select) s1Select.value = s1Type;
        if (r1Select) r1Select.value = s1Room;

        // Populate Shift 2 values
        const s2Type = norm.shift2Type ? norm.shift2Type : 'บ';
        const s2Room = norm.room2 ? norm.room2 : nurse.primaryDept;
        const s2Select = document.getElementById('edit-shift2-type');
        const r2Select = document.getElementById('edit-shift2-room');
        if (s2Select) s2Select.value = s2Type;
        if (r2Select) r2Select.value = s2Room;

        // Determine Mode
        let initialMode = 'single';
        if (norm.shiftType === 'Off' && !norm.shift2Type) {
            initialMode = 'off';
        } else if (norm.shift2Type && norm.shift2Type !== 'Off') {
            initialMode = 'dual';
        } else {
            initialMode = 'single';
        }

        this.setShiftEditMode(initialMode, false);
        this.handleShiftEditChange();

        this.openModal('edit-shift-modal');
    }

    setShiftEditMode(mode, triggerChange = true) {
        const modeInput = document.getElementById('edit-shift-mode');
        if (modeInput) modeInput.value = mode;

        const tabSingle = document.getElementById('tab-mode-single');
        const tabDual = document.getElementById('tab-mode-dual');
        const tabOff = document.getElementById('tab-mode-off');

        if (tabSingle) tabSingle.classList.toggle('active', mode === 'single');
        if (tabDual) tabDual.classList.toggle('active', mode === 'dual');
        if (tabOff) tabOff.classList.toggle('active', mode === 'off');

        const card1 = document.getElementById('shift1-config-card');
        const card2 = document.getElementById('shift2-config-card');
        const grid = document.getElementById('shifts-config-grid');
        const title1 = document.getElementById('shift1-card-title');
        const hint1 = document.getElementById('shift1-hint');

        if (mode === 'off') {
            if (grid) grid.style.display = 'none';
        } else if (mode === 'single') {
            if (grid) {
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = '1fr';
            }
            if (card1) card1.style.display = 'flex';
            if (card2) card2.style.display = 'none';
            if (title1) title1.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ข้อมูลกะเวรเดี่ยว`;
            if (hint1) hint1.textContent = 'เต็มช่อง ◼';
        } else if (mode === 'dual') {
            if (grid) {
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = '1fr 1fr';
            }
            if (card1) card1.style.display = 'flex';
            if (card2) card2.style.display = 'flex';
            if (title1) title1.innerHTML = `<i class="fa-solid fa-1"></i> กะที่ 1 (ฝั่งบนซ้าย)`;
            if (hint1) hint1.textContent = 'มุมซ้ายบน ◤';
        }

        if (triggerChange) {
            this.handleShiftEditChange();
        }
    }

    handleShiftEditChange() {
        const nurseId = document.getElementById('edit-shift-nurse-id').value;
        const month = parseInt(document.getElementById('edit-shift-month').value) || this.state.selectedMonth;
        const day = parseInt(document.getElementById('edit-shift-day').value) || 1;
        const mode = document.getElementById('edit-shift-mode').value || 'single';

        const nurse = this.state.staff.find(s => s.id === nurseId);
        const nurseDept = nurse ? nurse.primaryDept : 'ห้องER';

        let candidateShift = null;

        if (mode === 'off') {
            candidateShift = {
                day: day,
                month: month,
                shiftType: 'Off',
                room: 'Off',
                shift2Type: '',
                room2: ''
            };
        } else if (mode === 'single') {
            const s1Type = document.getElementById('edit-shift1-type').value || 'ช';
            const s1Room = document.getElementById('edit-shift1-room').value || nurseDept;

            candidateShift = {
                day: day,
                month: month,
                shiftType: s1Type,
                room: s1Room,
                shift2Type: '',
                room2: ''
            };
        } else if (mode === 'dual') {
            const s1Type = document.getElementById('edit-shift1-type').value || 'ช';
            const s1Room = document.getElementById('edit-shift1-room').value || nurseDept;

            const s2Type = document.getElementById('edit-shift2-type').value || 'บ';
            const s2Room = document.getElementById('edit-shift2-room').value || nurseDept;

            candidateShift = {
                day: day,
                month: month,
                shiftType: s1Type,
                room: s1Room,
                shift2Type: s2Type,
                room2: s2Room
            };
        }

        // 1. Update Live Preview Box
        const previewBox = document.getElementById('edit-live-preview-box');
        if (previewBox && candidateShift) {
            previewBox.innerHTML = this.renderShiftCellHTML(candidateShift, nurse ? nurse.name : '', day);
        }

        // 2. Validate Consecutive Rest Rules
        const ruleBadge = document.getElementById('edit-rule-badge');
        const ruleText = document.getElementById('edit-rule-text');
        if (ruleBadge && ruleText && nurseId) {
            const validation = this.validateNurseDayShift(nurseId, month, day, candidateShift);

            ruleBadge.className = `rule-badge-status ${validation.valid ? 'valid' : 'invalid'}`;
            ruleBadge.innerHTML = `
                <i class="fa-solid ${validation.valid ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                <span id="edit-rule-text">${validation.message}</span>
            `;
        }
    }

    saveShiftEdit(event) {
        if (event) event.preventDefault();

        const nurseId = document.getElementById('edit-shift-nurse-id').value;
        const month = parseInt(document.getElementById('edit-shift-month').value) || this.state.selectedMonth;
        const day = parseInt(document.getElementById('edit-shift-day').value) || 1;
        const mode = document.getElementById('edit-shift-mode').value || 'single';

        if (!nurseId || !this.state.schedule[nurseId]) {
            this.showToast("ไม่พบข้อมูลพยาบาลในระบบ", "error");
            return;
        }

        const nurse = this.state.staff.find(s => s.id === nurseId);
        const nurseDept = nurse ? nurse.primaryDept : 'ห้องER';

        let updatedShift = null;

        if (mode === 'off') {
            updatedShift = {
                day: day,
                month: month,
                shiftType: 'Off',
                room: 'Off',
                shift2Type: '',
                room2: ''
            };
        } else if (mode === 'single') {
            const s1Type = document.getElementById('edit-shift1-type').value || 'ช';
            const s1Room = document.getElementById('edit-shift1-room').value || nurseDept;

            updatedShift = {
                day: day,
                month: month,
                shiftType: s1Type,
                room: s1Room,
                shift2Type: '',
                room2: ''
            };
        } else if (mode === 'dual') {
            const s1Type = document.getElementById('edit-shift1-type').value || 'ช';
            const s1Room = document.getElementById('edit-shift1-room').value || nurseDept;

            const s2Type = document.getElementById('edit-shift2-type').value || 'บ';
            const s2Room = document.getElementById('edit-shift2-room').value || nurseDept;

            updatedShift = {
                day: day,
                month: month,
                shiftType: s1Type,
                room: s1Room,
                shift2Type: s2Type,
                room2: s2Room
            };
        }

        // Apply update to schedule state
        const monthShifts = this.getNurseShiftsForMonth(nurseId, month);
        monthShifts[day - 1] = updatedShift;
        this.state.schedule[nurseId][month] = monthShifts;

        // Persist to localStorage and Google Sheet
        this.saveStateToLocalStorage();

        // Close edit modal
        this.closeModal('edit-shift-modal');

        // Re-render views
        this.updateStats();
        if (this.state.activeView === 'room-selection') {
            this.renderOverviewGrid();
        } else if (this.state.activeView === 'specific-room') {
            this.renderSpecificRoomView();
        }

        // If individual schedule modal is open, refresh it
        const staffModal = document.getElementById('staff-detail-modal');
        if (staffModal && staffModal.classList.contains('active') && this.state.activeModalNurseId === nurseId) {
            this.openNurseIndividualSchedule(nurseId);
        }

        let desc = mode === 'dual' ? `2 กะ (${updatedShift.shiftType}/${updatedShift.shift2Type})` : (mode === 'off' ? 'วันหยุด (Off)' : `เวร ${updatedShift.shiftType}`);
        this.showToast(`บันทึกการแก้ไขเวรวันที่ ${day} ของ ${nurse ? nurse.name : ''} เป็น "${desc}" เรียบร้อยแล้ว`, 'success');
    }

    getRoomColorStyle(room) {
        if (room === 'ห้องER') {
            return `background: var(--room-er-bg); color: var(--room-er-color);`;
        } else if (room === 'ห้องคลอด') {
            return `background: var(--room-delivery-bg); color: var(--room-delivery-color);`;
        } else if (room === 'ห้องฉุกเฉิน') {
            return `background: var(--room-accident-bg); color: var(--room-accident-color);`;
        } else {
            return `background: var(--shift-off-bg); color: var(--shift-off-color); border: 1px solid rgba(45, 106, 79, 0.15);`;
        }
    }

    // ==========================================================================
    // System Utilities
    // ==========================================================================
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        else if (type === 'info') icon = 'fa-info-circle';

        toast.innerHTML = `
            <i class="fa-solid ${icon} toast-icon"></i>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after animation ends
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }
}

// Instantiate the App
const app = new NurseSchedulingApp();
window.app = app;
window.onload = () => app.init();


export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { staffNumber, restrictedTimeStr } = req.body;
    const API_TOKEN = process.env.OMNICHAT_API_TOKEN;

    if (!API_TOKEN) return res.status(500).json({ error: "API Token missing in Vercel" });

    // Helper functions
    function sanitizePhoneNumber(phone) {
        return phone.trim().replace(/^['"]|['"]$/g, '').replace(/\D/g, '');
    }

    function parseCustomDateGMT8(dateStr) {
        const parts = dateStr.trim().replace(/^['"]|['"]$/g, '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/i);
        if (!parts) return null;
        let [_, day, month, year, hours, minutes, seconds, meridiem] = parts;
        let hourNum = parseInt(hours, 10);
        if (meridiem.toUpperCase() === "PM" && hourNum < 12) hourNum += 12;
        if (meridiem.toUpperCase() === "AM" && hourNum === 12) hourNum = 0;
        const pad = (n) => n.toString().padStart(2, '0');
        return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hourNum)}:${pad(minutes)}:${pad(seconds)}+08:00`);
    }

    const cleanTargetNumber = sanitizePhoneNumber(staffNumber);
    const restrictedTime = parseCustomDateGMT8(restrictedTimeStr);

    if (!restrictedTime || isNaN(restrictedTime.getTime())) {
        return res.status(400).json({ error: "Invalid date format. Use dd/mm/yyyy hh:mm:ss AM/PM" });
    }

    const beforeMs = restrictedTime.getTime();
    const afterMs = beforeMs - (48 * 60 * 60 * 1000);

    try {
        let allMessages = [];
        let page = 1;
        let keepFetching = true;

        while (keepFetching) {
            const url = `https://open-api.omnichat.ai/v1/messages?page=${page}&pageSize=100&after=${afterMs}&before=${beforeMs}&platform=whatsapp&channelId=${cleanTargetNumber}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error("API Fetch Failed");
            const data = await response.json();
            
            if (data.content && data.content.length > 0) {
                allMessages.push(...data.content);
                if (data.content.length < 100) keepFetching = false;
                else page++;
            } else {
                keepFetching = false;
            }
        }

        const customerHistory = {}; 
        const staffMessagesOfInterest = [];

        for (const row of allMessages) {
            if (!row.roomId || !row.time || !row.senderType) continue;
            const lastHyphenIndex = row.roomId.lastIndexOf('-');
            const customerPhone = lastHyphenIndex !== -1 ? row.roomId.substring(lastHyphenIndex + 1) : row.roomId;
            const msgTime = new Date(row.time);
            
            const senderType = row.senderType.toLowerCase();
            const isCustomer = senderType === 'customer';
            const isStaff = senderType === 'agent' || senderType === 'bot';

            if (!isCustomer && !isStaff) continue;
            if (!customerHistory[customerPhone]) customerHistory[customerPhone] = [];
            
            const msgObj = { time: msgTime, isCustomer, customerPhone };
            customerHistory[customerPhone].push(msgObj);

            if (isStaff && msgTime < restrictedTime) {
                staffMessagesOfInterest.push(msgObj);
            }
        }

        for (const key in customerHistory) {
            customerHistory[key].sort((a, b) => a.time - b.time);
        }

        const intervals = [
            { label: "5 mins", ms: 5 * 60 * 1000 }, { label: "10 mins", ms: 10 * 60 * 1000 },
            { label: "30 mins", ms: 30 * 60 * 1000 }, { label: "1 hour", ms: 60 * 60 * 1000 },
            { label: "2 hours", ms: 2 * 60 * 60 * 1000 }, { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
            { label: "8 hours", ms: 8 * 60 * 60 * 1000 }, { label: "12 hours", ms: 12 * 60 * 60 * 1000 },
            { label: "24 hours", ms: 24 * 60 * 60 * 1000 }
        ];

        // Using arrays instead of Sets so we can send it back as JSON easily
        const results = {
            replied: { customers: intervals.map(() => new Set()), messages: intervals.map(() => 0) },
            reachedOut: { customers: intervals.map(() => new Set()), messages: intervals.map(() => 0) }
        };

        staffMessagesOfInterest.forEach(msg => {
            const diffMs = restrictedTime - msg.time;
            if (diffMs < 0 || diffMs > (24 * 60 * 60 * 1000)) return;

            const history = customerHistory[msg.customerPhone];
            let hasCustomerMsgInLast24h = false;
            const lookbackTime = new Date(msg.time.getTime() - (24 * 60 * 60 * 1000));
            
            for (const histMsg of history) {
                if (histMsg.time >= msg.time) break; 
                if (histMsg.isCustomer && histMsg.time >= lookbackTime) {
                    hasCustomerMsgInLast24h = true;
                    break;
                }
            }

            const type = hasCustomerMsgInLast24h ? 'replied' : 'reachedOut';
            intervals.forEach((interval, index) => {
                if (diffMs <= interval.ms) {
                    results[type].messages[index]++;
                    results[type].customers[index].add(msg.customerPhone);
                }
            });
        });

        // Format for frontend (convert Set to Size number)
        const frontendData = {
            intervals: intervals.map(i => i.label),
            repliedCustomers: results.replied.customers.map(s => s.size),
            repliedMessages: results.replied.messages,
            reachedOutCustomers: results.reachedOut.customers.map(s => s.size),
            reachedOutMessages: results.reachedOut.messages
        };

        return res.status(200).json(frontendData);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
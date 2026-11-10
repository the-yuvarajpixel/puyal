// ============================================================================
// RapidResponse Multilingual Translation Engine & Dictionary
// Languages: English (en), Tamil (ta), Hindi (hi), Telugu (te),
// Malayalam (ml), Kannada (kn), Bengali (bn), Spanish (es)
// ============================================================================

const RAPID_TRANSLATIONS = {
  en: {
    // Navigation
    "nav.brand_user": "RapidResponse Command",
    "nav.brand_admin": "RapidResponse — Admin Command Center",
    "nav.user_portal": "Civilian Emergency Portal",
    "nav.logout": "Logout",
    "nav.live_sync": "● Live Stream Active",
    "nav.translate_btn": "🌐 Translate",
    "nav.demo_badge": "Demo Account Active",

    // Readiness Bar
    "readiness.title": "Device Readiness:",
    "readiness.location": "Location:",
    "readiness.camera": "Camera:",
    "readiness.mic": "Mic:",
    "readiness.authorized": "Authorized",
    "readiness.denied": "Denied / Unavailable",
    "readiness.detecting": "Acquiring GPS...",
    "readiness.retest": "🔄 Re-test Permissions",

    // Action Cards
    "action.bhashini_title": "Bhashini Multilingual Voice",
    "action.bhashini_desc": "Speak in Tamil, Hindi, Telugu, English & more — Gemini AI classified",
    "action.sos_title": "SOS Emergency Live Stream",
    "action.sos_desc": "Streams live camera & audio directly to Admin Command Console",

    // Report Form
    "form.heading": "Report an Emergency Incident",
    "form.subheading": "Provide accurate details so response teams can prioritize and dispatch help.",
    "form.incident_title": "Incident Title *",
    "form.title_placeholder": "e.g., Multi-vehicle collision on NH-48",
    "form.category": "Emergency Category *",
    "form.severity": "Severity Level *",
    "form.severity_auto": "Auto-Classify (Threat Gauge)",
    "form.location": "Location *",
    "form.location_placeholder": "Area, Landmark, or Coordinates",
    "form.auto_btn": "📍 Auto GPS",
    "form.affected": "People Affected *",
    "form.description": "Description & Current Situation *",
    "form.desc_placeholder": "Describe hazards, trapped individuals, road blocks, or current conditions...",
    "form.contact": "Contact Phone / Name (Optional)",
    "form.contact_placeholder": "+91 98765 43210 or Reporter Name",
    "form.submit_btn": "🚨 Submit Emergency Report",

    // Threat Meter & AI Suggestion
    "meter.ai_title": "✨ AI Smart Severity Suggestion:",
    "meter.apply_suggested": "⚡ Apply Suggested:",
    "meter.threat_gauge": "⚡ Threat Severity Meter",
    "meter.low": "Low (0-25)",
    "meter.medium": "Medium (26-55)",
    "meter.high": "High (56-80)",
    "meter.critical": "Critical (81-100)",

    // Categories
    "cat.road_accident": "Road Accident",
    "cat.fire": "Fire",
    "cat.flood": "Flood",
    "cat.medical": "Medical Emergency",
    "cat.disaster": "Natural Disaster",
    "cat.crime": "Violence / Crime",
    "cat.collapse": "Structural Collapse",
    "cat.other": "Other",

    // User Incidents List
    "user_list.heading": "Active Community Incidents & AI Priority Ranks",
    "user_list.subheading": "Ranked in real-time by severity, people affected, category risk, and elapsed time.",
    "user_list.no_incidents": "No active incidents reported in this zone.",

    // Admin KPI Cards
    "admin.kpi.total": "Total Emergency Incidents",
    "admin.kpi.critical": "Critical Incidents",
    "admin.kpi.available": "Available Response Teams",
    "admin.kpi.busy": "Busy Response Teams",
    "admin.kpi.assigned": "Assigned Incidents",
    "admin.kpi.resolved": "Resolved Incidents",

    // Admin Map
    "admin.map.heading": "Tactical Command Map & Real-Time GPS Tracking",
    "admin.map.subheading": "Interactive 2km perimeter rings, station depots, response vehicles, and active dispatch route polylines.",
    "admin.map.disasters": "Disasters",
    "admin.map.perimeter": "2km Perimeter",
    "admin.map.vehicles": "Vehicles",
    "admin.map.stations": "Stations",
    "admin.map.sos": "SOS Beacons",
    "admin.map.routes": "Active Routes",
    "admin.map.center_btn": "🎯 Center Tactical View",

    // Government Platform Depot
    "admin.gov.heading": "Government Platform & Disaster Management Depot",
    "admin.gov.subheading": "Inter-agency fleet mobilization with AI smart grouping to conserve vehicles and fuel.",
    "admin.gov.group_btn": "⚡ AI Grouped Strike Force Dispatch",
    "admin.gov.reset_btn": "🔄 Reset Fleet Readiness",
    "admin.gov.ambulances": "Ambulances (ALS / BLS)",
    "admin.gov.fire": "Fire Tenders & Foam",
    "admin.gov.ndrf": "NDRF Rescue Squads",
    "admin.gov.boats": "Flood Rescue Boats",
    "admin.gov.erv": "Highway Patrol ERVs",

    // Response Teams Management
    "admin.teams.heading": "Emergency Response Team Management",
    "admin.teams.subheading": "Create, classify, and track emergency response teams, expertise, and deployment status.",
    "admin.teams.create_team_btn": "+ Create Response Team",
    "admin.teams.create_station_btn": "+ Register Station",
    "admin.teams.all_filter": "All Teams",
    "admin.teams.avail_filter": "Available",
    "admin.teams.dispatched_filter": "Dispatched",
    "admin.teams.scene_filter": "On Scene",

    // Incidents Queue
    "admin.incidents.heading": "Emergency Incidents Queue & Priority Ranking",
    "admin.incidents.subheading": "Ranked automatically by severity, affected count, emergency category, and elapsed reporting time.",
    "admin.incidents.auto_assign": "⚡ Auto-Assign Nearest Available Team",
    "admin.incidents.all_filter": "All Incidents",
    "admin.incidents.critical_filter": "Critical",
    "admin.incidents.high_filter": "High",
    "admin.incidents.med_filter": "Medium / Low",

    // Live Feed
    "admin.feed.heading": "Live Civilian Emergency Video & Audio Feed",
    "admin.feed.close": "Close Live Stream",
    "admin.feed.waiting": "Awaiting live civilian emergency broadcast...",
    "admin.feed.simulated_tag": "📹 SIMULATED TACTICAL FEED FALLBACK ACTIVE"
  },

  ta: {
    // Navigation
    "nav.brand_user": "RapidResponse கட்டளை",
    "nav.brand_admin": "RapidResponse — தலைமை கட்டளை மையம்",
    "nav.user_portal": "பொதுமக்கள் அவசர தளம்",
    "nav.logout": "வெளியேறு",
    "nav.live_sync": "● நேரலை இணைப்பு செயலில்",
    "nav.translate_btn": "🌐 மொழிபெயர்",
    "nav.demo_badge": "டெமோ கணக்கு செயலில்",

    // Readiness Bar
    "readiness.title": "சாதன தயார்நிலை:",
    "readiness.location": "இருப்பிடம்:",
    "readiness.camera": "கேமரா:",
    "readiness.mic": "மைக்:",
    "readiness.authorized": "அங்கீகரிக்கப்பட்டது",
    "readiness.denied": "மறுக்கப்பட்டது / கிடைக்கவில்லை",
    "readiness.detecting": "GPS கண்டறியப்படுகிறது...",
    "readiness.retest": "🔄 அனுமதிகளை மீண்டும் சோதி",

    // Action Cards
    "action.bhashini_title": "பாஷினி பலமொழி குரல் பதிவு",
    "action.bhashini_desc": "தமிழ், இந்தி, தெலுங்கு, ஆங்கிலத்தில் பேசுங்கள் — ஜெமினி AI வகைப்படுத்தும்",
    "action.sos_title": "SOS அவசர நேரலை ஒளிபரப்பு",
    "action.sos_desc": "நேரடி கேமரா மற்றும் ஆடியோவை நிர்வாகி கட்டளை மையத்திற்கு நேரடியாக அனுப்புகிறது",

    // Report Form
    "form.heading": "அவசர சம்பவத்தைப் புகாரளிக்கவும்",
    "form.subheading": "மீட்புக் குழுக்கள் விரைவாக உதவ துல்லியமான விவரங்களை வழங்கவும்.",
    "form.incident_title": "சம்பவ தலைப்பு *",
    "form.title_placeholder": "எ.கா. NH-48 நெடுஞ்சாலை வாகன விபத்து",
    "form.category": "அவசர வகை *",
    "form.severity": "தீவிர நிலை *",
    "form.severity_auto": "தானியங்கி வகைப்பாடு (அச்சுறுத்தல் அளவுமானி)",
    "form.location": "இருப்பிடம் *",
    "form.location_placeholder": "பகுதி, மைல்கல் அல்லது GPS ஆயத்தொலைவுகள்",
    "form.auto_btn": "📍 தானியங்கி GPS",
    "form.affected": "பாதிக்கப்பட்ட மக்கள் *",
    "form.description": "விளக்கம் மற்றும் தற்போதைய நிலை *",
    "form.desc_placeholder": "ஆபத்துகள், சிக்கிய நபர்கள், சாலைத் தடைகள் அல்லது நிலைமையை விவரிக்கவும்...",
    "form.contact": "தொடர்பு எண் / பெயர் (விருப்பத்திற்குரியது)",
    "form.contact_placeholder": "+91 98765 43210 அல்லது தகவல் தருபவர் பெயர்",
    "form.submit_btn": "🚨 அவசர அறிக்கையை சமர்ப்பிக்கவும்",

    // Threat Meter & AI Suggestion
    "meter.ai_title": "✨ AI ஸ்மார்ட் தீவிர பரிந்துரை:",
    "meter.apply_suggested": "⚡ பரிந்துரையைப் பயன்படுத்து:",
    "meter.threat_gauge": "⚡ அச்சுறுத்தல் தீவிர அளவுமானி",
    "meter.low": "குறைவு (0-25)",
    "meter.medium": "மிதமானது (26-55)",
    "meter.high": "அதிகம் (56-80)",
    "meter.critical": "மிக அவசரம் (81-100)",

    // Categories
    "cat.road_accident": "சாலை விபத்து",
    "cat.fire": "தீ விபத்து",
    "cat.flood": "வெள்ளம்",
    "cat.medical": "மருத்துவ அவசரம்",
    "cat.disaster": "இயற்கை பேரிடர்",
    "cat.crime": "வன்முறை / குற்றம்",
    "cat.collapse": "கட்டிட இடிபாடு",
    "cat.other": "மற்றவை",

    // User Incidents List
    "user_list.heading": "செயலில் உள்ள சம்பவங்கள் & AI முன்னுரிமை",
    "user_list.subheading": "தீவிரம், பாதிக்கப்பட்டவர்கள் மற்றும் அவசரநிலை அடிப்படையில் நிகழ்நேரத்தில் வரிசைப்படுத்தப்பட்டது.",
    "user_list.no_incidents": "இந்த பகுதியில் செயலில் உள்ள சம்பவங்கள் எதுவும் இல்லை.",

    // Admin KPI Cards
    "admin.kpi.total": "மொத்த அவசர சம்பவங்கள்",
    "admin.kpi.critical": "மிக அவசர சம்பவங்கள்",
    "admin.kpi.available": "கிடைக்கும் மீட்புக்குழுக்கள்",
    "admin.kpi.busy": "பணியில் உள்ள குழுக்கள்",
    "admin.kpi.assigned": "ஒதுக்கப்பட்ட சம்பவங்கள்",
    "admin.kpi.resolved": "தீர்க்கப்பட்ட சம்பவங்கள்",

    // Admin Map
    "admin.map.heading": "தந்திரோபாய வரைபடம் & நிகழ்நேர GPS கண்காணிப்பு",
    "admin.map.subheading": "2 கிமீ சுற்றளவு வளையங்கள், நிலையங்கள், அவசர வாகனங்கள் மற்றும் நேரடி பாதைகளுடன் கூடிய வரைபடம்.",
    "admin.map.disasters": "பேரிடர்கள்",
    "admin.map.perimeter": "2கிமீ சுற்றளவு",
    "admin.map.vehicles": "வாகனங்கள்",
    "admin.map.stations": "நிலையங்கள்",
    "admin.map.sos": "SOS சிக்னல்",
    "admin.map.routes": "நேரடி பாதைகள்",
    "admin.map.center_btn": "🎯 வரைபடத்தை மையப்படுத்து",

    // Government Platform Depot
    "admin.gov.heading": "அரசு தளம் & பேரிடர் மேலாண்மை மையம்",
    "admin.gov.subheading": "வாகனங்கள் மற்றும் எரிபொருளைச் சேமிக்க AI ஸ்மார்ட் குழுவாக்கத்துடன் கூடிய மீட்பு கடற்படை.",
    "admin.gov.group_btn": "⚡ AI ஒருங்கிணைந்த அதிரடிப்படை அனுப்புதல்",
    "admin.gov.reset_btn": "🔄 கடற்படையை மீட்டமைக்கவும்",
    "admin.gov.ambulances": "ஆம்புலன்ஸ்கள் (ALS / BLS)",
    "admin.gov.fire": "தீயணைப்பு வாகனங்கள்",
    "admin.gov.ndrf": "NDRF மீட்புக்குழுக்கள்",
    "admin.gov.boats": "வெள்ள மீட்பு படகுகள்",
    "admin.gov.erv": "நெடுஞ்சாலை ரோந்து ERV",

    // Response Teams Management
    "admin.teams.heading": "அவசர மீட்புக்குழு மேலாண்மை",
    "admin.teams.subheading": "மீட்புக் குழுக்களை உருவாக்குதல், வகைப்படுத்துதல் மற்றும் அவற்றின் GPS நிலைகளைக் கண்காணித்தல்.",
    "admin.teams.create_team_btn": "+ மீட்புக்குழுவை உருவாக்கு",
    "admin.teams.create_station_btn": "+ நிலையத்தைப் பதிவுசெய்",
    "admin.teams.all_filter": "அனைத்து குழுக்கள்",
    "admin.teams.avail_filter": "கிடைக்கும் குழுக்கள்",
    "admin.teams.dispatched_filter": "அனுப்பப்பட்டவை",
    "admin.teams.scene_filter": "களத்தில் உள்ளவை",

    // Incidents Queue
    "admin.incidents.heading": "அவசர சம்பவங்கள் வரிசை & முன்னுரிமை தரம்",
    "admin.incidents.subheading": "தீவிரம், பாதிக்கப்பட்டவர்களின் எண்ணிக்கை, வகை மற்றும் நேரத்தின் அடிப்படையில் தானாக வரிசைப்படுத்தப்பட்டது.",
    "admin.incidents.auto_assign": "⚡ அருகிலுள்ள குழுவை தானாக ஒதுக்கு",
    "admin.incidents.all_filter": "அனைத்து சம்பவங்கள்",
    "admin.incidents.critical_filter": "மிக அவசரம்",
    "admin.incidents.high_filter": "உயர் தீவிரம்",
    "admin.incidents.med_filter": "மிதமானது / குறைவு",

    // Live Feed
    "admin.feed.heading": "நேரடி பொதுமக்கள் அவசர வீடியோ & ஆடியோ",
    "admin.feed.close": "நேரலை ஸ்ட்ரீமை மூடு",
    "admin.feed.waiting": "நேரடி அவசர ஒளிபரப்பிற்காக காத்திருக்கிறது...",
    "admin.feed.simulated_tag": "📹 உருவகப்படுத்தப்பட்ட தந்திரோபாய நேரலை செயலில் உள்ளது"
  },

  hi: {
    // Navigation
    "nav.brand_user": "RapidResponse कमांड",
    "nav.brand_admin": "RapidResponse — कमान केंद्र",
    "nav.user_portal": "नागरिक आपातकालीन पोर्टल",
    "nav.logout": "लॉग आउट",
    "nav.live_sync": "● लाइव स्ट्रीम सक्रिय",
    "nav.translate_btn": "🌐 अनुवाद करें",
    "nav.demo_badge": "डेमो खाता सक्रिय",

    // Readiness Bar
    "readiness.title": "डिवाइस तत्परता:",
    "readiness.location": "स्थान:",
    "readiness.camera": "कैमरा:",
    "readiness.mic": "माइक:",
    "readiness.authorized": "अधिकृत",
    "readiness.denied": "अस्वीकृत / अनुपलब्ध",
    "readiness.detecting": "GPS प्राप्त हो रहा है...",
    "readiness.retest": "🔄 अनुमतियाँ पुनः जांचें",

    // Action Cards
    "action.bhashini_title": "भाषिणी बहुभाषी वॉइस रिपोर्ट",
    "action.bhashini_desc": "तमिल, हिंदी, तेलुगु, अंग्रेजी और अन्य में बोलें — जेमिनी AI वर्गीकृत करेगा",
    "action.sos_title": "SOS आपातकालीन लाइव स्ट्रीम",
    "action.sos_desc": "लाइव कैमरा और ऑडियो सीधे कमांड कंसोल पर प्रसारित करता है",

    // Report Form
    "form.heading": "आपातकालीन घटना की रिपोर्ट करें",
    "form.subheading": "सटीक विवरण प्रदान करें ताकि प्रतिक्रिया टीमें शीघ्र सहायता भेज सकें।",
    "form.incident_title": "घटना का शीर्षक *",
    "form.title_placeholder": "उदा. हाईवे NH-48 पर वाहनों की टक्कर",
    "form.category": "आपातकालीन श्रेणी *",
    "form.severity": "गंभीरता स्तर *",
    "form.severity_auto": "स्वतः वर्गीकृत (खतरा गेज)",
    "form.location": "स्थान *",
    "form.location_placeholder": "क्षेत्र, लैंडमार्क या GPS निर्देशांक",
    "form.auto_btn": "📍 स्वतः GPS",
    "form.affected": "प्रभावित लोग *",
    "form.description": "विवरण और वर्तमान स्थिति *",
    "form.desc_placeholder": "खतरों, फंसे लोगों, सड़क अवरोधों या वर्तमान स्थिति का वर्णन करें...",
    "form.contact": "संपर्क फोन / नाम (वैकल्पिक)",
    "form.contact_placeholder": "+91 98765 43210 या नाम",
    "form.submit_btn": "🚨 आपातकालीन रिपोर्ट सबमिट करें",

    // Threat Meter & AI Suggestion
    "meter.ai_title": "✨ AI स्मार्ट गंभीरता सुझाव:",
    "meter.apply_suggested": "⚡ सुझाव लागू करें:",
    "meter.threat_gauge": "⚡ खतरा गंभीरता मीटर",
    "meter.low": "कम (0-25)",
    "meter.medium": "मध्यम (26-55)",
    "meter.high": "उच्च (56-80)",
    "meter.critical": "अत्यंत गंभीर (81-100)",

    // Categories
    "cat.road_accident": "सड़क दुर्घटना",
    "cat.fire": "आग",
    "cat.flood": "बाढ़",
    "cat.medical": "चिकित्सा आपातकाल",
    "cat.disaster": "प्राकृतिक आपदा",
    "cat.crime": "हिंसा / अपराध",
    "cat.collapse": "इमारत गिरना",
    "cat.other": "अन्य",

    // User Incidents List
    "user_list.heading": "सक्रिय समुदाय घटनाएँ और AI प्राथमिकता रैंक",
    "user_list.subheading": "गंभीरता, प्रभावित लोगों और समय के आधार पर वास्तविक समय में रैंक किया गया।",
    "user_list.no_incidents": "इस क्षेत्र में कोई सक्रिय घटना दर्ज नहीं है।",

    // Admin KPI Cards
    "admin.kpi.total": "कुल आपातकालीन घटनाएँ",
    "admin.kpi.critical": "गंभीर घटनाएँ",
    "admin.kpi.available": "उपलब्ध प्रतिक्रिया टीमें",
    "admin.kpi.busy": "व्यस्त प्रतिक्रिया टीमें",
    "admin.kpi.assigned": "सौंपी गई घटनाएँ",
    "admin.kpi.resolved": "सुलझाई गई घटनाएँ",

    // Admin Map
    "admin.map.heading": "सामरिक कमान नक्शा और रियल-टाइम GPS ट्रैकिंग",
    "admin.map.subheading": "2 किमी परिधि के छल्ले, स्टेशन डिपो, आपातकालीन वाहन और लाइव डिस्पैच रूट लाइनें।",
    "admin.map.disasters": "आपदाएं",
    "admin.map.perimeter": "2किमी परिधि",
    "admin.map.vehicles": "वाहन",
    "admin.map.stations": "स्टेशन",
    "admin.map.sos": "SOS बीकन",
    "admin.map.routes": "सक्रिय मार्ग",
    "admin.map.center_btn": "🎯 नक्शा केंद्रित करें",

    // Government Platform Depot
    "admin.gov.heading": "सरकारी मंच और आपदा प्रबंधन डिपो",
    "admin.gov.subheading": "वाहनों और ईंधन की बचत के लिए AI स्मार्ट समूहीकरण के साथ बेड़ा प्रबंधन।",
    "admin.gov.group_btn": "⚡ AI समूहीकृत स्ट्राइक फोर्स प्रेषण",
    "admin.gov.reset_btn": "🔄 बेड़े की तैयारी रीसेट करें",
    "admin.gov.ambulances": "एम्बुलेंस (ALS / BLS)",
    "admin.gov.fire": "दमकल वाहन",
    "admin.gov.ndrf": "NDRF बचाव दल",
    "admin.gov.boats": "बाढ़ बचाव नावें",
    "admin.gov.erv": "हाईवे पेट्रोल ERV",

    // Response Teams Management
    "admin.teams.heading": "आपातकालीन प्रतिक्रिया दल प्रबंधन",
    "admin.teams.subheading": "प्रतिक्रिया दल बनाएं, वर्गीकृत करें और उनकी स्थिति ट्रैक करें।",
    "admin.teams.create_team_btn": "+ प्रतिक्रिया टीम बनाएं",
    "admin.teams.create_station_btn": "+ स्टेशन पंजीकृत करें",
    "admin.teams.all_filter": "सभी टीमें",
    "admin.teams.avail_filter": "उपलब्ध",
    "admin.teams.dispatched_filter": "भेजी गई",
    "admin.teams.scene_filter": "घटनास्थल पर",

    // Incidents Queue
    "admin.incidents.heading": "आपातकालीन घटना कतार और प्राथमिकता रैंकिंग",
    "admin.incidents.subheading": "गंभीरता, प्रभावित संख्या, श्रेणी और समय के आधार पर स्वतः क्रमबद्ध।",
    "admin.incidents.auto_assign": "⚡ निकटतम टीम को स्वतः सौंपें",
    "admin.incidents.all_filter": "सभी घटनाएँ",
    "admin.incidents.critical_filter": "गंभीर",
    "admin.incidents.high_filter": "उच्च",
    "admin.incidents.med_filter": "मध्यम / कम",

    // Live Feed
    "admin.feed.heading": "लाइव नागरिक आपातकालीन वीडियो और ऑडियो फीड",
    "admin.feed.close": "लाइव स्ट्रीम बंद करें",
    "admin.feed.waiting": "लाइव नागरिक आपातकालीन प्रसारण की प्रतीक्षा है...",
    "admin.feed.simulated_tag": "📹 सिम्युलेटेड टैक्टिकल फीड सक्रिय"
  },

  te: {
    // Telugu
    "nav.brand_user": "RapidResponse కమాండ్",
    "nav.brand_admin": "RapidResponse — అడ్మిన్ కమాండ్ సెంటర్",
    "nav.user_portal": "పౌర అత్యవసర పోర్టల్",
    "nav.logout": "లాగౌట్",
    "nav.live_sync": "● లైవ్ స్ట్రీమ్ క్రియాశీలం",
    "nav.translate_btn": "🌐 అనువదించు",
    "nav.demo_badge": "డెమో ఖాతా క్రియాశీలం",
    "readiness.title": "పరికరం సంసిద్ధత:",
    "readiness.location": "స్థానం:",
    "readiness.camera": "కెమెరా:",
    "readiness.mic": "మైక్:",
    "readiness.authorized": "అనుమతించబడింది",
    "readiness.denied": "నిరాకరించబడింది",
    "readiness.detecting": "GPS కనుగొనబడుతోంది...",
    "readiness.retest": "🔄 అనుమతులను మళ్లీ పరీక్షించండి",
    "action.bhashini_title": "భాషిణి బహుభాషా వాయిస్ రిపోర్ట్",
    "action.bhashini_desc": "తెలుగు, తమిళం, హిందీ, ఇంగ్లీషులో మాట్లాడండి — జెమిని AI వర్గీకరిస్తుంది",
    "action.sos_title": "SOS లైవ్ స్ట్రీమ్ ఎమర్జెన్సీ",
    "action.sos_desc": "కమాండ్ కన్సోల్‌కు లైవ్ కెమెరా & ఆడియోను నేరుగా ప్రసారం చేస్తుంది",
    "form.heading": "అత్యవసర సంఘటనను నివేదించండి",
    "form.subheading": "సహాయం అందించడానికి ఖచ్చితమైన వివరాలను తెలియజేయండి.",
    "form.incident_title": "సంఘటన శీర్షిక *",
    "form.title_placeholder": "ఉదా. NH-48 రహదారి ప్రమాదం",
    "form.category": "అత్యవసర వర్గం *",
    "form.severity": "తీవ్రత స్థాయి *",
    "form.location": "స్థానం *",
    "form.auto_btn": "📍 ఆటో GPS",
    "form.affected": "బాధితుల సంఖ్య *",
    "form.description": "వివరణ మరియు ప్రస్తుత పరిస్థితి *",
    "form.contact": "సంప్రదింపు ఫోన్ / పేరు",
    "form.submit_btn": "🚨 అత్యవసర నివేదిక సమర్పించండి",
    "meter.threat_gauge": "⚡ ముప్పు తీవ్రత మీటర్",
    "admin.kpi.total": "మొత్తం అత్యవసర సంఘటనలు",
    "admin.kpi.critical": "తీవ్రమైన సంఘటనలు",
    "admin.kpi.available": "అందుబాటులో ఉన్న బృందాలు",
    "admin.kpi.busy": "బిజీగా ఉన్న బృందాలు",
    "admin.kpi.assigned": "కేటాయించిన సంఘటనలు",
    "admin.kpi.resolved": "పరిష్కరించబడినవి",
    "admin.map.heading": "వ్యూహాత్మక మ్యాప్ & రియల్-టైమ్ GPS ట్రాకింగ్",
    "admin.gov.heading": "ప్రభుత్వ ప్లాట్‌ఫారమ్ & విపత్తు నిర్వహణ డిపో",
    "admin.teams.heading": "రెస్పాన్స్ టీమ్ మేనేజ్‌మెంట్",
    "admin.incidents.heading": "అత్యవసర సంఘటనల జాబితా & ప్రాధాన్యత",
    "admin.feed.heading": "లైవ్ ఎమర్జెన్సీ వీడియో & ఆడియో ఫీడ్"
  },

  ml: {
    // Malayalam
    "nav.brand_user": "RapidResponse കമാൻഡ്",
    "nav.brand_admin": "RapidResponse — കമാൻഡ് സെന്റർ",
    "nav.user_portal": "പൗര അടിയന്തര പോർട്ടൽ",
    "nav.logout": "ലോഗ് ഔട്ട്",
    "nav.live_sync": "● ലൈവ് സ്ട്രീം സജീവം",
    "nav.translate_btn": "🌐 വിവർത്തനം",
    "nav.demo_badge": "ഡെമോ അക്കൗണ്ട് സജീവം",
    "readiness.title": "ഉപകരണ സന്നദ്ധത:",
    "readiness.location": "സ്ഥാനം:",
    "readiness.camera": "ക്യാമറ:",
    "readiness.mic": "മൈക്ക്:",
    "readiness.authorized": "അംഗീകരിച്ചു",
    "readiness.denied": "നിരസിച്ചു",
    "readiness.detecting": "GPS കണ്ടെത്തുന്നു...",
    "readiness.retest": "🔄 അനുമതികൾ വീണ്ടും പരിശോധിക്കുക",
    "action.bhashini_title": "ഭാഷിണി ബഹുഭാഷാ വോയ്‌സ്",
    "action.bhashini_desc": "മലയാളം, തമിഴ്, ഹിന്ദി, ഇംഗ്ലീഷ് എന്നിവയിൽ സംസാരിക്കുക — Gemini AI തരംതിരിക്കും",
    "action.sos_title": "SOS തത്സമയ സ്ട്രീം",
    "action.sos_desc": "കമാൻഡ് സെന്ററിലേക്ക് ലൈവ് ക്യാമറയും ഓഡിയോയും അയയ്ക്കുന്നു",
    "form.heading": "അടിയന്തര സംഭവം റിപ്പോർട്ട് ചെയ്യുക",
    "form.subheading": "രക്ഷാപ്രവർത്തകർക്ക് ഉടൻ എത്താൻ കൃത്യമായ വിവരങ്ങൾ നൽകുക.",
    "form.incident_title": "സംഭവത്തിന്റെ പേര് *",
    "form.title_placeholder": "ഉദാ. റോഡ് അപകടം",
    "form.category": "അടിയന്തര വിഭാഗം *",
    "form.severity": "തീവ്രത നില *",
    "form.location": "സ്ഥാനം *",
    "form.auto_btn": "📍 ഓട്ടോ GPS",
    "form.affected": "ബാധിച്ച ആളുകൾ *",
    "form.description": "വിവരണം *",
    "form.contact": "ഫോൺ നമ്പർ / പേര്",
    "form.submit_btn": "🚨 അടിയന്തര റിപ്പോർട്ട് സമർപ്പിക്കുക",
    "meter.threat_gauge": "⚡ ഭീഷണി തീവ്രത മീറ്റർ",
    "admin.kpi.total": "ആകെ അടിയന്തര സംഭവങ്ങൾ",
    "admin.kpi.critical": "ഗുരുതരമായ സംഭവങ്ങൾ",
    "admin.kpi.available": "ലഭ്യമായ ടീമുകൾ",
    "admin.kpi.busy": "നിയോഗിച്ച ടീമുകൾ",
    "admin.kpi.assigned": "ഏൽപ്പിച്ച സംഭവങ്ങൾ",
    "admin.kpi.resolved": "പരിഹരിച്ച സംഭവങ്ങൾ",
    "admin.map.heading": "ടാക്റ്റിക്കൽ മാപ്പും തത്സമയ GPS ട്രാക്കിംഗും",
    "admin.gov.heading": "ഗവൺമെന്റ് പ്ലാറ്റ്‌ഫോമും ഡിസാസ്റ്റർ ഡിപ്പോയും",
    "admin.teams.heading": "റെസ്പോൺസ് ടീം മാനേജ്മെന്റ്",
    "admin.incidents.heading": "അടിയന്തര സംഭവങ്ങളുടെ മുൻഗണനാ പട്ടിക",
    "admin.feed.heading": "ലൈവ് അടിയന്തര വീഡിയോ & ഓഡിയോ ഫീഡ്"
  },

  kn: {
    // Kannada
    "nav.brand_user": "RapidResponse ಕಮಾಂಡ್",
    "nav.brand_admin": "RapidResponse — ಕಮಾಂಡ್ ಸೆಂಟರ್",
    "nav.user_portal": "ನಾಗರಿಕ ತುರ್ತು ಪೋರ್ಟಲ್",
    "nav.logout": "ಲಾಗ್‌ಔಟ್",
    "nav.live_sync": "● ಲೈವ್ ಸ್ಟ್ರೀಮ್ ಸಕ್ರಿಯ",
    "nav.translate_btn": "🌐 ಅನುವಾದಿಸಿ",
    "nav.demo_badge": "ಡೆಮೊ ಖಾತೆ ಸಕ್ರಿಯ",
    "readiness.title": "ಸಾಧನ ಸನ್ನದ್ಧತೆ:",
    "readiness.location": "ಸ್ಥಳ:",
    "readiness.camera": "ಕ್ಯಾಮರಾ:",
    "readiness.mic": "ಮೈಕ್:",
    "readiness.authorized": "ಅಧಿಕೃತಗೊಳಿಸಲಾಗಿದೆ",
    "readiness.denied": "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    "readiness.detecting": "GPS ಪಡೆಯಲಾಗುತ್ತಿದೆ...",
    "readiness.retest": "🔄 ಅನುಮತಿಗಳನ್ನು ಮರುಪರಿಶೀಲಿಸಿ",
    "action.bhashini_title": "ಭಾಷಿಣಿ ಧ್ವನಿ ವರದಿ",
    "action.bhashini_desc": "ಕನ್ನಡ, ತಮಿಳು, ಹಿಂದಿ, ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ — Gemini AI ವರ್ಗೀಕರಿಸುತ್ತದೆ",
    "action.sos_title": "SOS ತುರ್ತು ಲೈವ್ ಸ್ಟ್ರೀಮ್",
    "action.sos_desc": "ಕಮಾಂಡ್ ಸೆಂಟರ್‌ಗೆ ಲೈವ್ ಕ್ಯಾಮೆರಾ ಮತ್ತು ಆಡಿಯೋ ಕಳುಹಿಸುತ್ತದೆ",
    "form.heading": "ತುರ್ತು ಘಟನೆಯನ್ನು ವರದಿ ಮಾಡಿ",
    "form.subheading": "ರಕ್ಷಣಾ ತಂಡಗಳು ತಕ್ಷಣ ಸಹಾಯ ಮಾಡಲು ನಿಖರ ವಿವರಗಳನ್ನು ಒದಗಿಸಿ.",
    "form.incident_title": "ಘಟನೆಯ ಶೀರ್ಷಿಕೆ *",
    "form.title_placeholder": "ಉದಾ. ಹೆದ್ದಾರಿಯಲ್ಲಿ ಅಪಘಾತ",
    "form.category": "ತುರ್ತು ವರ್ಗ *",
    "form.severity": "ತೀವ್ರತೆಯ ಮಟ್ಟ *",
    "form.location": "ಸ್ಥಳ *",
    "form.auto_btn": "📍 ಸ್ವಯಂ GPS",
    "form.affected": "ಬಾಧಿತ ಜನರ ಸಂಖ್ಯೆ *",
    "form.description": "ವಿವರಣೆ *",
    "form.contact": "ಸಂಪರ್ಕ ಸಂಖ್ಯೆ / ಹೆಸರು",
    "form.submit_btn": "🚨 ತುರ್ತು ವರದಿಯನ್ನು ಸಲ್ಲಿಸಿ",
    "meter.threat_gauge": "⚡ ಬೆದರಿಕೆ ತೀವ್ರತೆ ಮೀಟರ್",
    "admin.kpi.total": "ಒಟ್ಟು ತುರ್ತು ಘಟನೆಗಳು",
    "admin.kpi.critical": "ಗಂಭೀರ ಘಟನೆಗಳು",
    "admin.kpi.available": "ಲಭ್ಯವಿರುವ ತಂಡಗಳು",
    "admin.kpi.busy": "ಕಾರ್ಯನಿರತ ತಂಡಗಳು",
    "admin.kpi.assigned": "ನಿಯೋಜಿಸಲಾದ ಘಟನೆಗಳು",
    "admin.kpi.resolved": "ಪರಿಹರಿಸಲಾದ ಘಟನೆಗಳು",
    "admin.map.heading": "ಯುದ್ಧತಂತ್ರದ ನಕ್ಷೆ ಮತ್ತು ಲೈವ್ GPS ಟ್ರ್ಯಾಕಿಂಗ್",
    "admin.gov.heading": "ಸರ್ಕಾರಿ ವೇದಿಕೆ ಮತ್ತು ವಿಪತ್ತು ನಿರ್ವಹಣಾ ಡಿಪೋ",
    "admin.teams.heading": "ತುರ್ತು ಪ್ರತಿಕ್ರಿಯೆ ತಂಡಗಳ ನಿರ್ವಹಣೆ",
    "admin.incidents.heading": "ತುರ್ತು ಘಟನೆಗಳ ಆದ್ಯತೆ ಪಟ್ಟಿ",
    "admin.feed.heading": "ಲೈವ್ ತುರ್ತು ವೀಡಿಯೊ & ಆಡಿಯೊ ಫೀಡ್"
  },

  bn: {
    // Bengali
    "nav.brand_user": "RapidResponse কমান্ড",
    "nav.brand_admin": "RapidResponse — কমান্ড সেন্টার",
    "nav.user_portal": "নাগরিক জরুরি পোর্টাল",
    "nav.logout": "লগআউট",
    "nav.live_sync": "● লাইভ স্ট্রিম সক্রিয়",
    "nav.translate_btn": "🌐 অনুবাদ",
    "nav.demo_badge": "ডেমো অ্যাকাউন্ট সক্রিয়",
    "readiness.title": "ডিভাইস প্রস্তুতি:",
    "readiness.location": "অবস্থান:",
    "readiness.camera": "ক্যামেরা:",
    "readiness.mic": "মাইক:",
    "readiness.authorized": "অনুমোদিত",
    "readiness.denied": "প্রত্যাখ্যাত",
    "readiness.detecting": "GPS অনুসন্ধান চলছে...",
    "readiness.retest": "🔄 অনুমতি পুনরায় পরীক্ষা করুন",
    "action.bhashini_title": "ভাষিণী বহুভাষিক ভয়েস রিপোর্ট",
    "action.bhashini_desc": "বাংলা, তামিল, হিন্দি, ইংরেজিতে বলুন — Gemini AI শ্রেণীবদ্ধ করবে",
    "action.sos_title": "SOS জরুরি লাইভ স্ট্রিম",
    "action.sos_desc": "কমান্ড কনসোলে লাইভ ক্যামেরা ও অডিও সরাসরি সম্প্রচার করে",
    "form.heading": "একটি জরুরি ঘটনা রিপোর্ট করুন",
    "form.subheading": "উদ্ধারকারী দল যাতে দ্রুত সহায়তা পাঠাতে পারে তার জন্য সঠিক তথ্য দিন।",
    "form.incident_title": "ঘটনার শিরোনাম *",
    "form.title_placeholder": "উদাঃ মহাসড়কে দুর্ঘটনা",
    "form.category": "জরুরি বিভাগ *",
    "form.severity": "তীব্রতার স্তর *",
    "form.location": "অবস্থান *",
    "form.auto_btn": "📍 স্বয়ংক্রিয় GPS",
    "form.affected": "ক্ষতিগ্রস্ত মানুষের সংখ্যা *",
    "form.description": "বিবরণ ও বর্তমান পরিস্থিতি *",
    "form.contact": "যোগাযোগের ফোন / নাম",
    "form.submit_btn": "🚨 জরুরি রিপোর্ট জমা দিন",
    "meter.threat_gauge": "⚡ বিপদ তীব্রতা মিটার",
    "admin.kpi.total": "মোট জরুরি ঘটনা",
    "admin.kpi.critical": "মারাত্মক ঘটনা",
    "admin.kpi.available": "উপলব্ধ দলসমূহ",
    "admin.kpi.busy": "ব্যস্ত দলসমূহ",
    "admin.kpi.assigned": "নিয়োজিত ঘটনা",
    "admin.kpi.resolved": "সমাধানকৃত ঘটনা",
    "admin.map.heading": "কৌশলগত মানচিত্র ও রিয়েল-টাইম GPS ট্র্যাকিং",
    "admin.gov.heading": "সরকারি প্ল্যাটফর্ম ও দুর্যোগ ব্যবস্থাপনা ডিপো",
    "admin.teams.heading": "জরুরি প্রতিক্রিয়া দল পরিচালনা",
    "admin.incidents.heading": "জরুরি ঘটনা ও অগ্রাধিকার তালিকা",
    "admin.feed.heading": "লাইভ জরুরি ভিডিও ও অডিও ফিড"
  },

  es: {
    // Spanish
    "nav.brand_user": "Comando RapidResponse",
    "nav.brand_admin": "RapidResponse — Centro de Mando",
    "nav.user_portal": "Portal Civil de Emergencias",
    "nav.logout": "Cerrar sesión",
    "nav.live_sync": "● Transmisión en vivo activa",
    "nav.translate_btn": "🌐 Traducir",
    "nav.demo_badge": "Cuenta de Demostración Activa",
    "readiness.title": "Preparación del dispositivo:",
    "readiness.location": "Ubicación:",
    "readiness.camera": "Cámara:",
    "readiness.mic": "Micrófono:",
    "readiness.authorized": "Autorizado",
    "readiness.denied": "Denegado / No disponible",
    "readiness.detecting": "Obteniendo GPS...",
    "readiness.retest": "🔄 Volver a probar permisos",
    "action.bhashini_title": "Voz Multilingüe Bhashini",
    "action.bhashini_desc": "Hable en español, inglés, tamil, hindi y más — Clasificado por Gemini AI",
    "action.sos_title": "Transmisión en Vivo SOS",
    "action.sos_desc": "Transmite cámara y audio en vivo directamente a la consola de mando",
    "form.heading": "Reportar un Incidente de Emergencia",
    "form.subheading": "Proporcione detalles precisos para que los equipos puedan priorizar y despachar ayuda.",
    "form.incident_title": "Título del Incidente *",
    "form.title_placeholder": "ej. Choque múltiple en autopista",
    "form.category": "Categoría de Emergencia *",
    "form.severity": "Nivel de Severidad *",
    "form.severity_auto": "Clasificación automática",
    "form.location": "Ubicación *",
    "form.location_placeholder": "Área, punto de referencia o coordenadas GPS",
    "form.auto_btn": "📍 GPS Auto",
    "form.affected": "Personas Afectadas *",
    "form.description": "Descripción y Situación Actual *",
    "form.desc_placeholder": "Describa peligros, personas atrapadas o condiciones actuales...",
    "form.contact": "Teléfono de contacto / Nombre",
    "form.contact_placeholder": "+91 98765 43210 o Nombre",
    "form.submit_btn": "🚨 Enviar Reporte de Emergencia",
    "meter.ai_title": "✨ Sugerencia Inteligente de Severidad AI:",
    "meter.apply_suggested": "⚡ Aplicar Sugerida:",
    "meter.threat_gauge": "⚡ Medidor de Severidad de Amenaza",
    "meter.low": "Bajo (0-25)",
    "meter.medium": "Medio (26-55)",
    "meter.high": "Alto (56-80)",
    "meter.critical": "Crítico (81-100)",
    "cat.road_accident": "Accidente Vial",
    "cat.fire": "Incendio",
    "cat.flood": "Inundación",
    "cat.medical": "Emergencia Médica",
    "cat.disaster": "Desastre Natural",
    "cat.crime": "Violencia / Crimen",
    "cat.collapse": "Colapso Estructural",
    "cat.other": "Otro",
    "user_list.heading": "Incidentes Activos y Rango de Prioridad AI",
    "user_list.subheading": "Clasificado en tiempo real por severidad, personas afectadas y tiempo transcurrido.",
    "user_list.no_incidents": "No hay incidentes activos reportados en esta zona.",
    "admin.kpi.total": "Total de Incidentes",
    "admin.kpi.critical": "Incidentes Críticos",
    "admin.kpi.available": "Equipos Disponibles",
    "admin.kpi.busy": "Equipos Ocupados / Despachados",
    "admin.kpi.assigned": "Incidentes Asignados",
    "admin.kpi.resolved": "Incidentes Resueltos",
    "admin.map.heading": "Mapa Táctico de Mando y Rastreo GPS en Tiempo Real",
    "admin.map.subheading": "Anillos perimetrales de 2 km, estaciones, vehículos y rutas de despacho activas.",
    "admin.map.disasters": "Desastres",
    "admin.map.perimeter": "Perímetro 2km",
    "admin.map.vehicles": "Vehículos",
    "admin.map.stations": "Estaciones",
    "admin.map.sos": "Balizas SOS",
    "admin.map.routes": "Rutas Activas",
    "admin.map.center_btn": "🎯 Centrar Mapa Táctico",
    "admin.gov.heading": "Plataforma Gubernamental y Depósito de Gestión de Desastres",
    "admin.gov.subheading": "Movilización de flota entre agencias con agrupación inteligente de IA para ahorrar combustible y vehículos.",
    "admin.gov.group_btn": "⚡ Despacho de Fuerza de Choque Agrupada",
    "admin.gov.reset_btn": "🔄 Restablecer Flota",
    "admin.gov.ambulances": "Ambulancias (ALS / BLS)",
    "admin.gov.fire": "Camiones de Bomberos",
    "admin.gov.ndrf": "Escuadrones de Rescate NDRF",
    "admin.gov.boats": "Botes de Rescate de Inundación",
    "admin.gov.erv": "Patrullas de Autopista ERV",
    "admin.teams.heading": "Gestión de Equipos de Respuesta a Emergencias",
    "admin.teams.subheading": "Crear, clasificar y rastrear equipos de respuesta, experiencia y estado de despliegue.",
    "admin.teams.create_team_btn": "+ Crear Equipo de Respuesta",
    "admin.teams.create_station_btn": "+ Registrar Estación",
    "admin.teams.all_filter": "Todos los Equipos",
    "admin.teams.avail_filter": "Disponibles",
    "admin.teams.dispatched_filter": "Despachados",
    "admin.teams.scene_filter": "En Escena",
    "admin.incidents.heading": "Cola de Incidentes y Clasificación de Prioridad",
    "admin.incidents.subheading": "Clasificado automáticamente por severidad, número de afectados, categoría y tiempo.",
    "admin.incidents.auto_assign": "⚡ Asignar Automáticamente el Equipo Más Cercano",
    "admin.incidents.all_filter": "Todos los Incidentes",
    "admin.incidents.critical_filter": "Crítico",
    "admin.incidents.high_filter": "Alto",
    "admin.incidents.med_filter": "Medio / Bajo",
    "admin.feed.heading": "Transmisión en Vivo de Video y Audio de Emergencia Civil",
    "admin.feed.close": "Cerrar Transmisión",
    "admin.feed.waiting": "Esperando transmisión de emergencia civil en vivo...",
    "admin.feed.simulated_tag": "📹 TRANSMISIÓN TÁCTICA SIMULADA ACTIVA"
  }
};

// Language names
const RAPID_LANG_NAMES = {
  en: "English",
  ta: "தமிழ் (Tamil)",
  hi: "हिन्दी (Hindi)",
  te: "తెలుగు (Telugu)",
  ml: "മലയാളം (Malayalam)",
  kn: "ಕನ್ನಡ (Kannada)",
  bn: "বাংলা (Bengali)",
  es: "Español (Spanish)"
};

// Active language
let currentAppLanguage = localStorage.getItem('rapid_language') || 'en';

/**
 * Get translated string by key with fallback to English
 */
function t(key, lang = currentAppLanguage) {
  const dict = RAPID_TRANSLATIONS[lang] || RAPID_TRANSLATIONS['en'];
  if (dict && dict[key]) return dict[key];
  if (RAPID_TRANSLATIONS['en'][key]) return RAPID_TRANSLATIONS['en'][key];
  return key;
}

/**
 * Translate all elements in the current DOM
 */
function translatePage(lang) {
  if (!lang) lang = currentAppLanguage;
  if (!RAPID_TRANSLATIONS[lang]) lang = 'en';

  currentAppLanguage = lang;
  localStorage.setItem('rapid_language', lang);
  document.documentElement.lang = lang;

  // Sync any dropdown on the page
  const selectEl = document.getElementById('global-lang-select');
  if (selectEl && selectEl.value !== lang) {
    selectEl.value = lang;
  }

  // Translate elements with data-i18n
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key, lang);
    if (translation) {
      el.textContent = translation;
    }
  });

  // Translate placeholders with data-i18n-placeholder
  const inputs = document.querySelectorAll('[data-i18n-placeholder]');
  inputs.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translation = t(key, lang);
    if (translation) {
      el.setAttribute('placeholder', translation);
    }
  });

  // Translate titles with data-i18n-title
  const titled = document.querySelectorAll('[data-i18n-title]');
  titled.forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = t(key, lang);
    if (translation) {
      el.setAttribute('title', translation);
    }
  });

  // Dispatch custom event for dynamic components to update
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));

  return lang;
}

/**
 * Global trigger called by translation button
 */
function onGlobalTranslateClick() {
  const selectEl = document.getElementById('global-lang-select');
  const targetLang = selectEl ? selectEl.value : 'ta';
  translatePage(targetLang);

  const langName = RAPID_LANG_NAMES[targetLang] || targetLang;
  if (typeof showToast === 'function') {
    showToast(`🌐 Page translated to ${langName}!`, 'success');
  }
}

// Auto-translate on page load once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('rapid_language') || 'en';
  translatePage(savedLang);
});

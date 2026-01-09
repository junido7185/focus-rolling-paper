// ▼ STEP 1에서 복사한 firebaseConfig로 교체하세요! ▼
const firebaseConfig = {
  apiKey: "AIzaSyAZXra6ZXlVTu2yri67r5hwNY-Hmn44NHY",
  authDomain: "focusrollingpaper-d0380.firebaseapp.com",
  projectId: "focusrollingpaper-d0380",
  messagingSenderId: "58286049044",
  appId: "1:58286049044:web:41b52e0a875882da29a401"
};

// 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 11명 (나 포함) -> 내가 로그인하면 나머지 10명이 슬롯에 보임
const USERS = [
    { name: "이호진", id: "202021019" }, { name: "정이룸", id: "202121255" },
    { name: "이윤서", id: "202220113" }, { name: "장유진", id: "202220301" },
    { name: "신동준", id: "202121026" }, { name: "한주연", id: "202420039" },
    { name: "남영현", id: "202420733" }, { name: "조소은", id: "202320657" },
    { name: "김영광", id: "202420959" }, { name: "노혜연", id: "202320977" },
    { name: "김승한", id: "202420543" }
];

let currentUser = null;
let currentTarget = null;
let slotDataMap = {};
let selectedSlot = -1;

// [기능 1] 로그인
function login() {
    const name = document.getElementById('input-name').value;
    const id = document.getElementById('input-id').value;
    const user = USERS.find(u => u.name === name && u.id === id);

    if (user) {
        currentUser = user;
        sessionStorage.setItem('user', JSON.stringify(user));
        
        const bgm = document.getElementById('bgm-player');
        if(bgm) bgm.play().catch(e => console.log('Click to play BGM'));

        showPage('dashboard-page');
        initDashboard();
        document.getElementById('welcome-msg').innerText = `Hello, ${user.name}`;
    } else {
        alert("정보를 확인해주세요.");
    }
}

// [기능 2] 대시보드 (친구들 10명 + 내 카드 정중앙)
function initDashboard() {
    const list = document.getElementById('member-list');
    list.innerHTML = '';

    // 1. 나를 제외한 친구들 (10명)
    const otherMembers = USERS.filter(user => user.id !== currentUser.id);

    // 2. 친구들 카드 생성 (5명씩 2줄로 자연스럽게 배치됨)
    otherMembers.forEach(user => {
        const card = createCard(user, false);
        list.appendChild(card);
    });

    // 3. 나의 롤링페이퍼 카드 생성 (맨 마지막 -> Flexbox 덕분에 자동으로 다음 줄 중앙에 위치)
    const myUser = { name: "나의 롤링페이퍼", id: currentUser.id }; // 화면 표시용 가짜 객체
    const myCard = createCard(myUser, true);
    list.appendChild(myCard);
}

// 카드 생성 헬퍼 함수 (사진 자동 로딩 포함)
function createCard(user, isMyCard) {
    const card = document.createElement('div');
    card.className = 'member-polaroid';
    if (isMyCard) card.classList.add('my-card');
    
    // 약간의 랜덤 회전으로 자연스러움 연출 (-2도 ~ 2도)
    card.style.transform = `rotate(${Math.random() * 4 - 2}deg)`;

    // 이미지 경로: assets/이름.jpg
    // 이미지가 없으면 onerror 이벤트가 발생해서 자동으로 아이콘으로 바뀜
    const imgName = isMyCard ? currentUser.name : user.name;
    
    // 내 카드일 때는 클릭 시 내꺼 열기, 남의 카드면 남의꺼 열기
    card.onclick = () => isMyCard ? openMyPaper() : openPaper(user);

    card.innerHTML = `
        <div class="mem-img-box">
            <img src="assets/${imgName}.jpg" 
                 class="profile-img" 
                 onerror="this.style.display='none'; this.parentNode.innerHTML='<span class=\'material-icons-round\'>face</span>'">
        </div>
        <span class="mem-name">${user.name}</span>
    `;
    
    return card;
}

// [기능 3] 롤링페이퍼 열기
function openPaper(target) {
    currentTarget = target;
    document.getElementById('target-name').innerText = `${target.name}의 롤링페이퍼`;
    showPage('paper-page');
    loadMessages();
}

// [기능 4] 데이터 로드 (0~9번 슬롯)
function loadMessages() {
    document.querySelectorAll('.slot').forEach(el => {
        el.className = el.className.replace(' filled', '');
        el.innerHTML = '';
    });
    slotDataMap = {};

    db.collection('messages').where('to', '==', currentTarget.id).orderBy('createdAt').get()
    .then(snap => {
        let index = 0;
        snap.forEach(doc => {
            if (index > 9) return; // 10명 제한 (0~9)
            const data = doc.data();
            renderSlot(index, data);
            slotDataMap[index] = data;
            index++;
        });
    });
}

function renderSlot(index, data) {
    const slot = document.getElementById(`slot-${index}`);
    if (!slot) return;
    
    slot.classList.add('filled');
    
    if (data.imageUrl) {
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.className = 'slot-img';
        slot.appendChild(img);
    } else {
        const p = document.createElement('p');
        p.className = 'slot-text';
        p.innerText = data.content.length > 8 ? data.content.substring(0, 8) + '..' : data.content;
        slot.appendChild(p);
    }
}

// [기능 5] 슬롯 클릭
function handleSlotClick(index) {
    if (slotDataMap[index]) {
        openReadModal(slotDataMap[index]);
        return;
    }
    if (currentUser.id === currentTarget.id) {
        alert("친구들을 기다려보세요!");
        return;
    }
    selectedSlot = index;
    openWriteModal();
}

// [기능 6] 작성 모달
function openWriteModal() {
    document.getElementById('write-modal').classList.add('open');
    document.getElementById('msg-input').value = '';
    document.getElementById('file-input').value = '';
    document.getElementById('img-preview-area').innerHTML = '';
}

// [기능 7] 이미지 압축 (무료 저장)
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            }
        }
    });
}

async function submitMessage() {
    const content = document.getElementById('msg-input').value;
    const fileInput = document.getElementById('file-input');
    const submitBtn = document.querySelector('.submit-btn');

    if(!content && fileInput.files.length === 0) return alert("내용을 입력해주세요.");
    
    submitBtn.innerText = "저장 중...";
    submitBtn.disabled = true;

    try {
        let imageUrl = null;
        if(fileInput.files.length > 0) {
            imageUrl = await compressImage(fileInput.files[0]);
        }

        await db.collection('messages').add({
            from: currentUser.name,
            to: currentTarget.id,
            content: content,
            imageUrl: imageUrl,
            createdAt: new Date()
        });

        const sound = document.getElementById('shutter-sound');
        if(sound) { sound.currentTime = 0; sound.play(); }

        alert("기록되었습니다.");
        closeModal();
        loadMessages();
    } catch (e) {
        console.error(e);
        alert("오류가 발생했습니다.");
    } finally {
        submitBtn.innerText = "기록하기";
        submitBtn.disabled = false;
    }
}

// [기능 8] 읽기 모달
function openReadModal(data) {
    const modal = document.getElementById('read-modal');
    modal.classList.add('open');
    document.getElementById('read-content').innerText = data.content;
    document.getElementById('read-from').innerText = `From. ${data.from}`;
    
    const imgWrapper = document.getElementById('read-img-wrapper');
    imgWrapper.innerHTML = '';
    if(data.imageUrl) {
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.style.width = '100%';
        img.style.borderRadius = '10px';
        imgWrapper.appendChild(img);
    }
}

// 유틸리티
function closeModal() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); }
function closeReadModal() { document.getElementById('read-modal').classList.remove('open'); }
function previewImage(input) {
    if(input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => document.getElementById('img-preview-area').innerHTML = `<img src="${e.target.result}">`;
        reader.readAsDataURL(input.files[0]);
    }
}
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function goBack() { showPage('dashboard-page'); }
function openMyPaper() { openPaper(currentUser); }

function capturePaper() {
    const target = document.querySelector("#paper-page");
    html2canvas(target, { useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `FOCUS_${currentTarget.name}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}
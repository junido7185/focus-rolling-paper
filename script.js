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

// 11명 멤버 리스트
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

// [기능 2] 대시보드 (친구들 10명 + 내 카드)
function initDashboard() {
    const list = document.getElementById('member-list');
    list.innerHTML = '';

    const otherMembers = USERS.filter(user => user.id !== currentUser.id);

    // 친구들 카드 생성
    otherMembers.forEach(user => {
        const card = createCard(user, false);
        list.appendChild(card);
    });

    // 내 카드 생성
    const myUser = { name: "나의 롤링페이퍼", id: currentUser.id };
    const myCard = createCard(myUser, true);
    list.appendChild(myCard);
}

// 카드 생성 헬퍼
function createCard(user, isMyCard) {
    const card = document.createElement('div');
    card.className = 'member-polaroid';
    if (isMyCard) card.classList.add('my-card');
    
    card.style.transform = `rotate(${Math.random() * 4 - 2}deg)`;

    const imgName = isMyCard ? currentUser.name : user.name;
    
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
    document.getElementById('target-name').innerText = `${target.name}의 책상`;
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
            if (index > 9) return;
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

// [기능 5] 슬롯 클릭 (권한 체크 강화)
function handleSlotClick(index) {
    const message = slotDataMap[index];

    // CASE 1: 이미 작성된 슬롯을 클릭했을 때 (읽기 권한 체크)
    if (message) {
        // 주인(Target)이거나 작성자(Me)인 경우만 열람 가능
        // (기존 데이터 호환을 위해 id 체크와 이름 체크 병행)
        const isOwner = currentUser.id === currentTarget.id;
        const isAuthor = (message.fromId === currentUser.id) || (message.from === currentUser.name);

        if (isOwner || isAuthor) {
            openReadModal(message);
        } else {
            alert("작성자와 주인공만 확인할 수 있어요 🔒");
        }
        return;
    }

    // CASE 2: 빈 슬롯을 클릭했을 때 (쓰기 권한 체크)
    
    // 본인은 본인 페이지에 작성 불가
    if (currentUser.id === currentTarget.id) {
        alert("친구들의 메시지를 기다려보세요!");
        return;
    }

    // [중요] 이미 이 사람에게 글을 썼는지 확인 (1인 1메시지 제한)
    // 현재 로드된 메시지들 중 내가 쓴 게 있는지 검사
    const alreadyWrote = Object.values(slotDataMap).some(msg => 
        msg.fromId === currentUser.id || msg.from === currentUser.name
    );

    if (alreadyWrote) {
        alert("이미 이 멤버에게 메시지를 남기셨습니다. (인당 하나~)");
        return;
    }

    // 작성 가능
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

// [기능 7] 이미지 압축
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

        // DB 저장 (fromId 추가 저장)
        await db.collection('messages').add({
            from: currentUser.name,
            fromId: currentUser.id, // ID를 같이 저장해야 정확한 구분이 가능
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
        // 스타일은 CSS에서 제어하지만 확실하게 인라인으로도 보장
        img.style.width = '100%';
        img.style.display = 'block';
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
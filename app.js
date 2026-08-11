// 〇〇様（ユーザー）から提供されたFirebaseの合鍵
const firebaseConfig = {
  apiKey: "AIzaSyBIoqp43gprMf75muKXZagcIbc9nEvyImc",
  authDomain: "mycs-24212.firebaseapp.com",
  projectId: "mycs-24212",
  storageBucket: "mycs-24212.firebasestorage.app",
  messagingSenderId: "313356996691",
  appId: "1:313356996691:web:7e399db9233cf02ebdf6a6"
};

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Firestoreのコレクション
const POSTS_COLLECTION = "posts";

document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const appContainer = document.getElementById('appContainer');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const postInput = document.getElementById('postInput');
    const postBtn = document.getElementById('postBtn');
    const charCount = document.getElementById('charCount');
    const timeline = document.getElementById('timeline');

    // メディア添付関連のUI要素
    const mediaInput = document.getElementById('mediaInput');
    const attachMediaBtn = document.getElementById('attachMediaBtn');
    const mediaPreviewContainer = document.getElementById('mediaPreviewContainer');
    const mediaPreviewGrid = document.getElementById('mediaPreviewGrid');
    
    // モーダル関連の要素
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeImageModalBtn = document.getElementById('closeImageModalBtn');

    // 画面切り替え（SPA）関連の要素
    const navHome = document.getElementById('navHome');
    const navDeleted = document.getElementById('navDeleted');
    const homePage = document.getElementById('homePage');
    const deletedPage = document.getElementById('deletedPage');
    const pageTitle = document.getElementById('pageTitle');
    const deletedTimeline = document.getElementById('deletedTimeline');

    let unsubscribeSnapshot = null;
    let selectedMediaFiles = [];

    // ==========================================
    // 画面切り替え（SPA）処理
    // ==========================================
    function switchPage(pageId) {
        // メニューのactive切り替え
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        
        homePage.style.display = 'none';
        deletedPage.style.display = 'none';
        document.getElementById('settingsPage').style.display = 'none';

        if (pageId === 'home') {
            navHome.classList.add('active');
            pageTitle.textContent = 'ホーム';
            homePage.style.display = 'block';
        } else if (pageId === 'deleted') {
            navDeleted.classList.add('active');
            pageTitle.textContent = 'ゴミ箱 (削除済み)';
            deletedPage.style.display = 'block';
        } else if (pageId === 'settings') {
            document.getElementById('navSettings').classList.add('active');
            pageTitle.textContent = '設定';
            document.getElementById('settingsPage').style.display = 'block';
        }
    }

    navHome.addEventListener('click', (e) => { e.preventDefault(); switchPage('home'); });
    navDeleted.addEventListener('click', (e) => { e.preventDefault(); switchPage('deleted'); });
    document.getElementById('navSettings').addEventListener('click', (e) => { e.preventDefault(); switchPage('settings'); });

    // ==========================================
    // 認証（ログイン・ログアウト）処理
    // ==========================================

    // ログイン状態の監視
    auth.onAuthStateChanged((user) => {
        if (user) {
            // ログイン成功時：ログイン画面を隠し、アプリ画面を表示
            loginOverlay.style.display = 'none';
            appContainer.style.display = 'flex';
            
            // データの読み込みを開始
            startRealtimeSync();
        } else {
            // 未ログイン時：アプリ画面を隠し、ログイン画面を表示
            loginOverlay.style.display = 'flex';
            appContainer.style.display = 'none';
            
            // データの読み込みを停止（セキュリティエラー防止）
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
        }
    });

    // ログインボタン処理
    loginBtn.addEventListener('click', async () => {
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        if (!email || !password) {
            loginError.textContent = "メールアドレスとパスワードを入力してください";
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "ログイン中...";
        loginError.textContent = "";

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // 成功すると onAuthStateChanged が発火するのでここでの画面切り替えは不要
        } catch (error) {
            console.error("ログインエラー:", error);
            loginError.textContent = "ログインに失敗しました。情報が正しいか確認してください。";
            loginBtn.disabled = false;
            loginBtn.textContent = "ログイン";
        }
    });

    // ログアウト処理
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            // 入力欄などをリセットしておく
            loginEmail.value = '';
            loginPassword.value = '';
            loginBtn.disabled = false;
            loginBtn.textContent = "ログイン";
            loginError.textContent = "";
        });
    });

    // ==========================================
    // 投稿とタイムライン処理
    // ==========================================

    function startRealtimeSync() {
        // すでに監視中の場合は二重に監視しないようにする
        if (unsubscribeSnapshot) return;

        unsubscribeSnapshot = db.collection(POSTS_COLLECTION)
            .orderBy("createdAt", "desc")
            .onSnapshot((snapshot) => {
                const activePosts = [];
                const deletedPosts = [];
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    const post = { id: doc.id, ...data };
                    // 削除フラグで振り分け
                    if (data.isDeleted) {
                        deletedPosts.push(post);
                    } else {
                        activePosts.push(post);
                    }
                });
                
                // ホーム用と削除済み一覧用の描画
                renderTimeline(activePosts, timeline, false);
                renderTimeline(deletedPosts, deletedTimeline, true);
            }, (error) => {
                console.error("データの取得中にエラーが発生しました:", error);
                timeline.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">データの読み込みに失敗しました。アクセス権限を確認してください。</div>';
            });
    }

    // 投稿フォームの入力イベント
    postInput.addEventListener('input', updatePostBtnState);

    function updatePostBtnState() {
        postInput.style.height = 'auto';
        postInput.style.height = (postInput.scrollHeight) + 'px';
        const textLength = postInput.value.length;
        charCount.textContent = textLength;
        // テキストがある、またはメディアが選択されていれば投稿可能
        postBtn.disabled = textLength === 0 && selectedMediaFiles.length === 0;
    }

    // メディア添付ボタンのクリック
    attachMediaBtn.addEventListener('click', () => {
        mediaInput.click();
    });

    // ファイルが選択された時の処理
    mediaInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // 最大4枚までの制限（X風に合わせる場合）
        const newFiles = files.slice(0, 4 - selectedMediaFiles.length);
        selectedMediaFiles = [...selectedMediaFiles, ...newFiles].slice(0, 4);
        
        renderMediaPreview();
        updatePostBtnState();
        
        // 連続して同じファイルを選べるようにリセット
        mediaInput.value = '';
    });

    // プレビューの描画処理
    function renderMediaPreview() {
        mediaPreviewGrid.innerHTML = '';
        if (selectedMediaFiles.length === 0) {
            mediaPreviewContainer.style.display = 'none';
            return;
        }

        mediaPreviewContainer.style.display = 'block';
        
        selectedMediaFiles.forEach((file, index) => {
            const fileUrl = URL.createObjectURL(file);
            const itemDiv = document.createElement('div');
            itemDiv.className = 'media-preview-item';
            
            let mediaEl = '';
            if (file.type.startsWith('image/')) {
                mediaEl = `<img src="${fileUrl}" alt="プレビュー" />`;
            } else if (file.type.startsWith('video/')) {
                mediaEl = `<video src="${fileUrl}" controls></video>`;
            }
            
            itemDiv.innerHTML = `
                ${mediaEl}
                <button class="remove-media-btn" data-index="${index}" title="削除">×</button>
            `;
            mediaPreviewGrid.appendChild(itemDiv);
        });

        // 削除ボタンにイベントを設定
        const removeBtns = mediaPreviewGrid.querySelectorAll('.remove-media-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                selectedMediaFiles.splice(idx, 1);
                renderMediaPreview();
                updatePostBtnState();
            });
        });
    }

    // 投稿ボタンクリック時のデータ保存
    postBtn.addEventListener('click', async () => {
        const text = postInput.value.trim();
        if (text.length === 0 && selectedMediaFiles.length === 0) return;

        postBtn.disabled = true;
        const originalText = postBtn.textContent;
        postBtn.textContent = '送信中...';

        try {
            let mediaArray = [];

            // メディアが選択されている場合はStorageにアップロード
            if (selectedMediaFiles.length > 0) {
                postBtn.textContent = `メディアアップロード中...`;
                
                const uploadPromises = selectedMediaFiles.map(async (file, index) => {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `posts/${auth.currentUser.uid}/${Date.now()}_${index}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                    const storageRef = storage.ref().child(fileName);
                    
                    await storageRef.put(file);
                    const url = await storageRef.getDownloadURL();
                    const type = file.type.startsWith('image/') ? 'image' : 'video';
                    
                    return { url, type };
                });

                // すべての画像を並行してアップロード
                mediaArray = await Promise.all(uploadPromises);
            }

            // --- 位置情報の取得 ---
            postBtn.textContent = '位置情報処理中...';
            let locationData = null;
            const locationToggle = document.getElementById('locationToggle');
            
            if (locationToggle && locationToggle.checked) {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                if (isMobile && navigator.geolocation) {
                    try {
                        const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
                        });
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        
                        // 逆ジオコーディング
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
                            const data = await res.json();
                            let placeName = data.address.city || data.address.town || data.address.village || data.address.state || data.address.province || "現在地付近";
                            locationData = { type: 'gps', name: placeName, lat, lon };
                        } catch (e) {
                            console.warn("逆ジオコーディング失敗", e);
                            locationData = { type: 'gps', name: "モバイル端末から(GPS)", lat, lon };
                        }
                    } catch (e) {
                        console.warn("GPS取得失敗", e);
                        locationData = { type: 'mobile', name: "モバイル端末から" };
                    }
                } else {
                    locationData = { type: 'desktop', name: "デスクトップ（自宅）から" };
                }
            }

            postBtn.textContent = '保存中...';

            await db.collection(POSTS_COLLECTION).add({
                text: text,
                media: mediaArray, // 複数メディアを配列で保存
                location: locationData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: auth.currentUser ? auth.currentUser.uid : "unknown"
            });
        } catch (error) {
            console.error("投稿の保存に失敗しました:", error);
            alert("投稿に失敗しました。エラー: " + error.message);
        } finally {
            postInput.value = '';
            postInput.style.height = 'auto';
            charCount.textContent = '0';
            
            // プレビューのリセット
            selectedMediaFiles = [];
            renderMediaPreview();

            postBtn.textContent = originalText;
            updatePostBtnState(); 
        }
    });

    // 日時フォーマット関数
    function formatTime(timestamp) {
        if (!timestamp) return "たった今";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // タイムライン描画関数
    function renderTimeline(posts, containerEl, isDeletedView) {
        containerEl.innerHTML = '';

        if (posts.length === 0) {
            containerEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">${isDeletedView ? '削除されたツイートはありません。' : 'まだツイートはありません。<br>最初のつぶやきを投稿してみましょう！'}</div>`;
            return;
        }

        posts.forEach(post => {
            const postEl = document.createElement('article');
            postEl.className = 'post';
            postEl.dataset.id = post.id;
            
            // 互換性対応: 古いデータ(mediaUrl)と新しいデータ(media配列)を吸収
            let mediaItems = [];
            if (post.media && Array.isArray(post.media)) {
                mediaItems = post.media;
            } else if (post.mediaUrl) {
                mediaItems = [{ url: post.mediaUrl, type: post.mediaType || 'image' }];
            }
            
            let mediaHTML = '';
            if (mediaItems.length > 0) {
                const gridCount = Math.min(mediaItems.length, 4); 
                let gridItemsHTML = mediaItems.map(item => {
                    if (item.type === 'video') {
                        return `<div class="grid-item"><video src="${item.url}" controls></video></div>`;
                    } else {
                        return `<div class="grid-item"><img src="${item.url}" class="timeline-image" alt="投稿画像" loading="lazy" data-src="${item.url}"></div>`;
                    }
                }).join('');

                mediaHTML = `
                    <div class="post-media-container">
                        <div class="media-grid" data-count="${gridCount}">
                            ${gridItemsHTML}
                        </div>
                    </div>
                `;
            }

            // 編集済みバッジ
            let editedBadgeHTML = '';
            if (post.isEdited) {
                const editTimeStr = formatTime(post.editedAt);
                editedBadgeHTML = `<span class="edited-badge" title="最終編集: ${editTimeStr}">（編集済み）</span>`;
            }

            // 位置情報バッジ
            let locationHTML = '';
            if (post.location && post.location.name) {
                locationHTML = `<div class="post-location">📍 ${escapeHTML(post.location.name)}</div>`;
            }

            // 操作メニュー (削除済み画面では表示しない、もしくは自分の投稿のみ表示など。今回は自分の投稿なら表示)
            let actionMenuHTML = '';
            const isOwnPost = auth.currentUser && post.userId === auth.currentUser.uid;
            
            if (isOwnPost && !isDeletedView) {
                actionMenuHTML = `
                    <div class="post-actions-menu">
                        <button class="menu-btn" onclick="toggleMenu('${post.id}')">⋯</button>
                        <div class="dropdown-menu" id="menu-${post.id}">
                            <div class="dropdown-item edit-btn" data-id="${post.id}">編集する</div>
                            <div class="dropdown-item delete-item delete-btn" data-id="${post.id}">削除する</div>
                        </div>
                    </div>
                `;
            }

            postEl.innerHTML = `
                <div class="avatar">
                    <img src="https://ui-avatars.com/api/?name=User&background=random" alt="User Avatar">
                </div>
                <div class="post-content">
                    <div class="post-header">
                        <span class="post-name">ユーザー名</span>
                        <span class="post-username">@myself</span>
                        <span class="post-time">· ${formatTime(post.createdAt)}</span>
                        ${editedBadgeHTML}
                    </div>
                    ${post.text ? `<div class="post-text" id="text-${post.id}">${escapeHTML(post.text)}</div>` : ''}
                    ${mediaHTML}
                    ${locationHTML}
                </div>
                ${actionMenuHTML}
            `;
            containerEl.appendChild(postEl);
        });

        // ドロップダウンメニューの開閉関数（グローバルに設定）
        window.toggleMenu = function(postId) {
            // 他のメニューを閉じる
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu.id !== `menu-${postId}`) menu.classList.remove('show');
            });
            const menu = document.getElementById(`menu-${postId}`);
            if (menu) menu.classList.toggle('show');
        };

        // 画面のどこかをクリックしたらメニューを閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.post-actions-menu')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });

        // 削除ボタンのイベント
        containerEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const postId = e.target.getAttribute('data-id');
                if (confirm('このツイートを削除しますか？（ゴミ箱に移動します）')) {
                    try {
                        await db.collection(POSTS_COLLECTION).doc(postId).update({
                            isDeleted: true,
                            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } catch (err) {
                        console.error('削除エラー:', err);
                        alert('削除に失敗しました。');
                    }
                }
            });
        });

        // 編集ボタンのイベント
        containerEl.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.target.getAttribute('data-id');
                const textEl = document.getElementById(`text-${postId}`);
                if (!textEl) return;

                // メニューを閉じる
                document.getElementById(`menu-${postId}`).classList.remove('show');

                const currentText = textEl.innerText || textEl.textContent; // 元のテキスト
                
                // 編集フォームに置換
                const editFormHTML = `
                    <textarea id="edit-input-${postId}" class="edit-textarea">${currentText}</textarea>
                    <div class="edit-actions">
                        <button class="btn-small btn-cancel" id="cancel-edit-${postId}">キャンセル</button>
                        <button class="btn-small btn-save" id="save-edit-${postId}">保存</button>
                    </div>
                `;
                textEl.outerHTML = `<div class="edit-container" id="edit-container-${postId}">${editFormHTML}</div>`;

                // キャンセル処理（再描画させるためにFirestoreから取り直すか、単に元のHTMLに戻す）
                document.getElementById(`cancel-edit-${postId}`).addEventListener('click', () => {
                    // 簡単な方法は、タイムライン自体を再描画（あるいは対象のドキュメントだけ再描画）することですが、
                    // スナップショットが常に走っているので、元のDOMを復元すればOK（リアルタイム同期で直る）
                    const container = document.getElementById(`edit-container-${postId}`);
                    container.outerHTML = `<div class="post-text" id="text-${postId}">${escapeHTML(currentText)}</div>`;
                });

                // 保存処理
                document.getElementById(`save-edit-${postId}`).addEventListener('click', async () => {
                    const newText = document.getElementById(`edit-input-${postId}`).value.trim();
                    const saveBtn = document.getElementById(`save-edit-${postId}`);
                    saveBtn.disabled = true;
                    saveBtn.textContent = '保存中...';

                    try {
                        await db.collection(POSTS_COLLECTION).doc(postId).update({
                            text: newText,
                            isEdited: true,
                            editedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        // updateが成功すると、onSnapshotが発火して自動で画面が再描画されます
                    } catch (err) {
                        console.error('編集エラー:', err);
                        alert('編集の保存に失敗しました。');
                        saveBtn.disabled = false;
                        saveBtn.textContent = '保存';
                    }
                });
            });
        });

        // 画像クリックイベント（拡大プレビュー表示）の登録
        const timelineImages = containerEl.querySelectorAll('.timeline-image');
        timelineImages.forEach(img => {
            img.addEventListener('click', (e) => {
                const src = e.target.getAttribute('data-src');
                openImageModal(src);
            });
        });
    }

    // 画像モーダルの開閉処理
    function openImageModal(src) {
        modalImage.src = src;
        imageModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // 背景のスクロールを防止
    }

    function closeImageModal() {
        imageModal.classList.remove('show');
        document.body.style.overflow = '';
        setTimeout(() => {
            modalImage.src = '';
        }, 250); // アニメーション終了後に画像を消す
    }

    closeImageModalBtn.addEventListener('click', closeImageModal);
    imageModal.addEventListener('click', (e) => {
        // 画像領域以外（背景）をクリックした場合のみ閉じる
        if (e.target === imageModal) {
            closeImageModal();
        }
    });

    // XSS対策
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // ==========================================
    // インポート・エクスポート（アーカイブ）処理
    // ==========================================
    const importFileInput = document.getElementById('importFileInput');
    const importYearMonth = document.getElementById('importYearMonth');
    const importOptions = document.getElementById('importOptions');
    const calculateImportBtn = document.getElementById('calculateImportBtn');
    const importCalculationResult = document.getElementById('importCalculationResult');
    const importBtn = document.getElementById('importBtn');
    const importProgress = document.getElementById('importProgress');
    const importProgressText = document.getElementById('importProgressText');
    const importProgressBar = document.getElementById('importProgressBar');
    const exportBtn = document.getElementById('exportBtn');

    let parsedTweets = [];
    let loadedZip = null;

    if(importFileInput) {
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            importOptions.style.display = 'none';
            importCalculationResult.style.display = 'none';
            importBtn.disabled = true;
            parsedTweets = [];
            loadedZip = null;

            try {
                loadedZip = await JSZip.loadAsync(file);
                const tweetsFiles = loadedZip.file(/data\/tweets\.js$/);
                if (!tweetsFiles || tweetsFiles.length === 0) {
                    alert("ZIP内に data/tweets.js が見つかりません。");
                    return;
                }
                const tweetsFile = tweetsFiles[0];

                const content = await tweetsFile.async("string");
                const jsonString = content.replace(/^window\.YTD\.tweets\.part0\s*=\s*/, '');
                parsedTweets = JSON.parse(jsonString);

                const yearMonths = new Set();
                parsedTweets.forEach(t => {
                    const date = new Date(t.tweet.created_at);
                    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    yearMonths.add(ym);
                });

                importYearMonth.innerHTML = '<option value="all">すべて</option>';
                Array.from(yearMonths).sort().forEach(ym => {
                    const option = document.createElement('option');
                    option.value = ym;
                    option.textContent = ym.replace('-', '年') + '月';
                    importYearMonth.appendChild(option);
                });

                importOptions.style.display = 'block';
            } catch (error) {
                console.error("ZIP読み込みエラー", error);
                alert("ファイルの読み込みに失敗しました。");
            }
        });
    }

    if(calculateImportBtn) {
        calculateImportBtn.addEventListener('click', async () => {
            if (!loadedZip || parsedTweets.length === 0) return;

            calculateImportBtn.disabled = true;
            calculateImportBtn.textContent = '計算中...';
            const selectedYM = importYearMonth.value;
            
            const targetTweets = parsedTweets.filter(t => {
                if (selectedYM === 'all') return true;
                const date = new Date(t.tweet.created_at);
                const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return ym === selectedYM;
            });

            let totalMediaBytes = 0;
            let mediaCount = 0;

            targetTweets.forEach(t => {
                const media = t.tweet.extended_entities?.media || [];
                media.forEach(m => {
                    const urlParts = m.media_url_https.split('/');
                    const filename = urlParts[urlParts.length - 1];
                    const baseName = filename.split('.')[0];
                    // 簡易検索（ZIP内のファイルリストから）
                    const files = loadedZip.file(new RegExp(`data/tweets_media/.*${baseName}`));
                    if (files && files.length > 0) {
                        totalMediaBytes += files[0]._data.uncompressedSize || files[0]._data.compressedSize || 0;
                        mediaCount++;
                    }
                });
            });

            const mb = (totalMediaBytes / (1024 * 1024)).toFixed(2);
            
            importCalculationResult.style.display = 'block';
            importCalculationResult.innerHTML = `
                <strong>インポート対象件数:</strong> ${targetTweets.length} 件<br>
                <strong>添付メディア数:</strong> ${mediaCount} ファイル (推定 ${mb} MB)<br>
                <div style="margin-top: 10px; font-size: 12px; color: #8899a6;">※Firebase Storageの無料枠は5GBです。</div>
            `;

            calculateImportBtn.disabled = false;
            calculateImportBtn.textContent = '容量と件数を計算';
            importBtn.disabled = false;
        });
    }

    if(importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!confirm("インポートを開始しますか？")) return;

            importBtn.disabled = true;
            importProgress.style.display = 'block';
            const selectedYM = importYearMonth.value;
            const targetTweets = parsedTweets.filter(t => {
                if (selectedYM === 'all') return true;
                const date = new Date(t.tweet.created_at);
                const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return ym === selectedYM;
            });

            const total = targetTweets.length;
            let processed = 0;

            for (const t of targetTweets) {
                const tweet = t.tweet;
                try {
                    const docRef = db.collection(POSTS_COLLECTION).doc(tweet.id);
                    const docSnap = await docRef.get();

                    if (!docSnap.exists) {
                        let mediaArray = [];
                        const mediaItems = tweet.extended_entities?.media || [];
                        
                        for (const m of mediaItems) {
                            const urlParts = m.media_url_https.split('/');
                            const filename = urlParts[urlParts.length - 1];
                            const baseName = filename.split('.')[0];
                            const files = loadedZip.file(new RegExp(`data/tweets_media/.*${baseName}`));
                            
                            if (files && files.length > 0) {
                                const fileData = await files[0].async("blob");
                                const storagePath = `posts/${auth.currentUser.uid}/${tweet.id}_${filename}`;
                                const storageRef = storage.ref().child(storagePath);
                                await storageRef.put(fileData);
                                const url = await storageRef.getDownloadURL();
                                const type = m.type === 'video' ? 'video' : 'image';
                                mediaArray.push({ url, type });
                            }
                        }

                        await docRef.set({
                            text: tweet.full_text || "",
                            media: mediaArray,
                            createdAt: new Date(tweet.created_at),
                            userId: auth.currentUser.uid,
                            imported: true,
                            originalId: tweet.id
                        });
                    }
                } catch (err) {
                    console.error("インポートエラー", err);
                }

                processed++;
                const percent = Math.floor((processed / total) * 100);
                importProgressBar.style.width = percent + '%';
                importProgressText.textContent = `${processed} / ${total} 件処理完了 (${percent}%)`;
            }

            alert("インポートが完了しました。");
            importProgressText.textContent = "インポート完了";
        });
    }

    if(exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!confirm("全データをXアーカイブ形式(ZIP)でダウンロードしますか？時間がかかる場合があります。")) return;
            exportBtn.disabled = true;
            exportBtn.textContent = "データ収集中...";

            try {
                const zip = new JSZip();
                const snapshot = await db.collection(POSTS_COLLECTION)
                    .where("userId", "==", auth.currentUser.uid)
                    .get();

                const exportTweets = [];
                const mediaPromises = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt ? data.createdAt.toDate().toUTCString() : new Date().toUTCString();
                    
                    const tweetObj = {
                        tweet: {
                            id: doc.id,
                            full_text: data.text || "",
                            created_at: createdAt,
                            extended_entities: { media: [] }
                        }
                    };

                    if (data.media && data.media.length > 0) {
                        data.media.forEach((m, idx) => {
                            const ext = m.type === 'video' ? 'mp4' : 'jpg';
                            const filename = `${doc.id}_${idx}.${ext}`;
                            tweetObj.tweet.extended_entities.media.push({
                                media_url_https: `https://.../${filename}`,
                                type: m.type
                            });
                            
                            mediaPromises.push(
                                fetch(m.url).then(res => res.blob()).then(blob => {
                                    zip.file(`data/tweets_media/${doc.id}-${filename}`, blob);
                                }).catch(e => console.warn("メディア取得失敗", e))
                            );
                        });
                    }
                    exportTweets.push(tweetObj);
                });

                exportBtn.textContent = "メディアダウンロード中...";
                await Promise.all(mediaPromises);

                exportBtn.textContent = "ZIPファイル生成中...";
                const tweetsJsContent = "window.YTD.tweets.part0 = " + JSON.stringify(exportTweets, null, 2);
                zip.file("data/tweets.js", tweetsJsContent);

                const blob = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `archive-${Date.now()}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                alert("エクスポートが完了しました。");
            } catch (error) {
                console.error("エクスポートエラー", error);
                alert("エクスポートに失敗しました。");
            } finally {
                exportBtn.disabled = false;
                exportBtn.textContent = "アーカイブをダウンロード";
            }
        });
    }

});

export function updatePageContent() {
    const token = getCookie("token");
    const loginBlock = document.getElementById("loginBlock");
    const userBlock = document.getElementById("userBlock");
    const heroLoginBlock = document.getElementById("heroLoginBlock");
    const heroUserBlock = document.getElementById("heroUserBlock");
    const itemLoginBlock = document.getElementById("itemLoginBlock");
    const itemUserBlock = document.getElementById("itemUserBlock");
    const itemMenuContainer = document.getElementById("itemMenuContainer");
    const logoLoginBlock = document.getElementById("logoLoginBlock");
    const logoUserBlock = document.getElementById("logoUserBlock");
    const lockerLoginBlock = document.getElementById("lockerLoginBlock");
    const lockerUserBlock = document.getElementById("lockerUserBlock");
    if (token) {
        loginBlock.style.display = "none";
        userBlock.style.display = "block";
        logoLoginBlock.style.display = "none";
        logoUserBlock.style.display = "flex";
        if (heroLoginBlock) {
            heroLoginBlock.style.display = "none";
        }
        if (heroUserBlock) {
            heroUserBlock.style.display = "block";
        }
        if (itemLoginBlock) {
            itemLoginBlock.style.display = "none";
        }
        if (itemUserBlock) {
            itemUserBlock.style.display = "block";
        }
        if (itemMenuContainer) {
            itemMenuContainer.style.display = "grid";
        }
        if (lockerLoginBlock) {
            lockerLoginBlock.style.display = "none";
        }
        if (lockerUserBlock) {
            lockerUserBlock.style.display = "flex";
        }
        fetch(`/userinfo`, {})
            .then((response) => response.json())
            .then((data) => {
                let firstName = data.user.username.split(" ");
                userBlock.innerHTML = `<li><a href="/userinfos">${firstName[0]}</a></li>
                    <li><a href="/logout" id="logoutButton">Logout</a></li>`;
                document
                    .getElementById("logoutButton")
                    .addEventListener("click", handleLogoutClick);
                if (heroUserBlock) {
                    heroUserBlock.innerHTML = `
                    <p style="text-align: center; text-transform: lowercase; margin: 0;" class="hero__lower-text"><span style="text-transform: uppercase;">W</span>elcome, <span style="text-transform: uppercase; color: #fa991c; font-weight: bold;">${data.user.username}</span> to our faculty!</p>`;
                }
                if (itemUserBlock) {
                    itemUserBlock.innerHTML = `
                    <p class="item__user-welcome-header" style="text-align: center; text-transform: lowercase;"><span style="text-transform: uppercase;">H</span>i, <span style="text-transform: uppercase; font-weight: bold;">${data.user.username}</span></p>`;
                }
            })
            .catch((error) => {
                console.error("Error fetching user information:", error);
                loginBlock.style.display = "block";
                userBlock.style.display = "none";
                logoLoginBlock.style.display = "flex";
                logoUserBlock.style.display = "none";
                if (heroLoginBlock) {
                    heroLoginBlock.style.display = "flex";
                }
                if (heroUserBlock) {
                    heroUserBlock.style.display = "none";
                }
                if (itemLoginBlock) {
                    itemLoginBlock.style.display = "flex";
                }
                if (itemUserBlock) {
                    itemUserBlock.style.display = "none";
                }
                if (itemMenuContainer) {
                    itemMenuContainer.style.display = "none";
                }
                if (lockerLoginBlock) {
                    lockerLoginBlock.style.display = "flex";
                }
                if (lockerUserBlock) {
                    lockerUserBlock.style.display = "none";
                }
            });
    } else {
        loginBlock.style.display = "block";
        userBlock.style.display = "none";
        logoLoginBlock.style.display = "flex";
        logoUserBlock.style.display = "none";
        if (heroLoginBlock) {
            heroLoginBlock.style.display = "flex";
        }
        if (heroUserBlock) {
            heroUserBlock.style.display = "none";
        }
        if (itemLoginBlock) {
            itemLoginBlock.style.display = "flex";
        }
        if (itemUserBlock) {
            itemUserBlock.style.display = "none";
        }
        if (itemMenuContainer) {
            itemMenuContainer.style.display = "none";
        }
        if (lockerLoginBlock) {
            lockerLoginBlock.style.display = "flex";
        }
        if (lockerUserBlock) {
            lockerUserBlock.style.display = "none";
        }
    }
}
function getCookie(name) {
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) { // +1
        const [cookieName, cookieValue] = cookie.split("=");
        if (cookieName === name) { // +2 (if and nesting)
            return cookieValue;
        }
    }
    return null;
}

export const handleMediaQuery = (mediaQuery) => {
    if (mediaQuery.matches) {
        document.querySelector(".navigation").style.display = "none";
        document.querySelector(".navigation__responsive").style.display =
            "flex";
    } else {
        document.querySelector(".navigation").style.display = "flex";
        document.querySelector(".navigation__responsive").style.display =
            "none";
    }
};

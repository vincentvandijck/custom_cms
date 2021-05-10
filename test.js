var xhr = new XMLHttpRequest();
xhr.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
    }
};
xhr.open("GET", "localhost:9002", true);
xhttp.send();
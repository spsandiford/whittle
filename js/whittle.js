var db;

function updateCurrentCount() {
    db.get("select count(path) as currentCount from files where rank >= 1", function(err,row) {
        if ((err == null) && (row != undefined)) {
            $("#whittle-current-container input").val(row.currentCount);
        }
    });
}

function getCurrentPointer() {
    return new Promise((resolve,reject) => {
        db.get("select item from pointers where name = ?", "current", function(err,row) {
            if ((err == null) && (row != undefined)) {
                var rowid = row.item;
                db.get("select rank from files where rowid = ?",row.item, function(err,row) {
                    if ((err == null) && (row != undefined)) {
                        if (row.rank > 0) {
                            console.log("Current pointer is " + rowid);
                            resolve(rowid);
                        } else {
                            // Search forwards
                            db.get("select rowid from files where rowid > ? and rank > 0",rowid, function(err,row) {
                                if ((err == null) && (row != undefined)) {
                                    var newrowid = row.rowid;
                                    db.run("update pointers set item = ? where name = ?",newrowid,"current",function(err,row) {
                                        console.log("Moved current pointer up to " + newrowid);
                                        resolve(newrowid);
                                    });
                                } else {
                                    // Search backwards
                                    db.get("select rowid from files where rowid < ? and rank > 0",rowid, function(err,row) {
                                        if ((err == null) && (row != undefined)) {
                                            var newrowid = row.rowid;
                                            db.run("update pointers set item = ? where name = ?",newrowid,"current",function(err,row) {
                                                console.log("Moved current pointer down to " + newrowid);
                                                resolve(newrowid);
                                            });
                                        } else {
                                            reject("Unable to find a file with rank > 0");
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        reject("Unable to get rank for rowid " + rowid);
                    }
                });
            } else {
                // Select the first item in files
                db.get("select min(rowid) as first from files where rank >= 1", function(err,row) {
                    if ((err == null) && (row != undefined)) {
                        var rowid = row.first;
                        db.run("insert into pointers (name,item) values (?,?)","current",rowid,function(err,row){
                            console.log("Added a current pointer to " + rowid);
                            resolve(rowid);
                        });
                    } else {
                        reject("Error getting min(rowid) from files");
                    }
                });
            }
        });
    });
}
function navRight() {
    getCurrentPointer().then(function(currentImage) {
        db.get("select rowid from files where rowid > ? and rank > 0",currentImage,function(err,row) {
            if ((err == null) && (row != undefined)) {
                console.log("Increasing current pointer to " + row.rowid);
                db.run("update pointers set item = ? where name = ?",row.rowid,"current",function(err,row) {
                    if (err == null) {
                        fillImages();
                    }
                });
            }
        });
    }, function(reason) {
        console.log(reason);
    });
}

function navLeft() {
    getCurrentPointer().then(function(currentImage) {
        db.get("select rowid from files where rowid < ? and rank > 0 order by rowid desc limit 1",currentImage,function(err,row) {
            if ((err == null) && (row != undefined)) {
                console.log("Decreasing current pointer to " + row.rowid);
                db.run("update pointers set item = ? where name = ?",row.rowid,"current",function(err,row) {
                    if (err == null) {
                        fillImages();
                    }
                });
            }
        });
    }, function(reason) {
        console.log(reason);
    });
}

function whittleImage() {
    getCurrentPointer().then(function(currentImage) {
        console.log("Whittling image, rowid " + currentImage);
        db.run("update files set rank = 0 where rowid = ?",currentImage,function(err,row) {
            if (err == null) {
                fillImages();
            }
        });
    }, function(reason) {
        console.log(reason);
    });
}

function fillImage(target, imagepath) {
    var newimgtag = '<img src="' + imagepath + '"></img>"';
    //console.log(target + ' ' + newimgtag);
    $(target).html(newimgtag);
    $(target + " img").on('load',fixOrientation);
}

function fillPlaceHolder(target) {
    fillImage(target, 'placeholder-blue.png');
}

function fillImages() {
    getCurrentPointer().then(function(currentImage) {
        // fill in the current image first
        db.get("select path from files where rowid = ? and rank > 0", currentImage, function(err, row) {
            fillImage('#whittle-current-image', row.path);
        });

        // fill in the first previous image
        db.get("select path,rowid from files where rowid < ? and rank > 0 order by rowid desc limit 1",
                currentImage, function(err, row) {

            var target1 = '#whittle-previous-1';
            var target2 = '#whittle-previous-2';

            if ((err == null) && (row != undefined)) {
                fillImage(target1,row.path);
                // fill in the second previous image
                db.get("select path from files where rowid < ? and rank > 0 order by rowid desc limit 1",
                        row.rowid, function(err2, row2) {
                    if ((err == null) && (row2 != undefined)) {
                        fillImage(target2, row2.path);
                    } else {
                        fillPlaceHolder(target2);
                    }
                });
            } else {
                fillPlaceHolder(target1);
                fillPlaceHolder(target2);
            }
        });

        // fill in the first next image
        db.get("select path,rowid from files where rowid > ? and rank > 0 order by rowid asc limit 1",
                currentImage, function(err, row) {

            var target1 = '#whittle-next-1';
            var target2 = '#whittle-next-2';

            if ((err == null) && (row != undefined)) {
                fillImage(target1,row.path);
                // fill in the second next image
                db.get("select path from files where rowid > ? and rank > 0 order by rowid asc limit 1",
                        row.rowid, function(err2, row2) {
                    if ((err == null) && (row2 != undefined)) {
                        fillImage(target2, row2.path);
                    } else {
                        fillPlaceHolder(target2);
                    }
                });
            } else {
                fillPlaceHolder(target1);
                fillPlaceHolder(target2);
            }
        });
    }, function(reason) {
    });

}

function fixOrientation(ev) {
    //console.log('image load handler');
    //console.log(ev);
    EXIF.getData(ev.target, function() {
        var orientation = EXIF.getTag(this, "Orientation");
        //console.log("orientation: " + orientation);
        if(orientation == 6) {
            $(ev.target).css('transform', 'rotate(90deg)')
        } else if (orientation == 3) {
            $(ev.target).css('transform', 'rotate(180deg)')
        } else if (orientation == 8) {
            $(ev.target).css('transform', 'rotate(-90deg)')
        }
    }); 
}

$(function() {
    const path = require('path');
    const fs = require('fs');
    const fileUrl = require('file-url');
    const sqlite3 = require('sqlite3').verbose();
    const recursive = require('recursive-readdir');
    var rootdir = nw.App.argv[0];
    console.log("root directory " + rootdir);
    db = new sqlite3.Database(path.join(rootdir,'whittle.db'));
    db.run("create table if not exists files (path TEXT UNIQUE PRIMARY KEY, rank INTEGER DEFAULT 1)");
    db.run("create table if not exists pointers (name TEXT UNIQUE PRIMARY KEY, item INTEGER DEFAULT 1)");
    recursive(rootdir, function(err, items) {
        var stmt = db.prepare("insert into files (path) values (?)");
        for (var i=0; i < items.length; i++) {
            var file_path = fileUrl(items[i]);
            //console.log(file_path);
            if (file_path.endsWith(".jpg")) {
                stmt.run(file_path);
            }
        }
        stmt.finalize();
        updateCurrentCount();
        fillImages();
    });
    $("body").on("keydown",function(ev) {
        if (ev.keyCode == 37) {
            // Left
            navLeft();
        } else if (ev.keyCode == 38) {
            // Up
        } else if (ev.keyCode == 39) {
            // Right
            navRight();
        } else if (ev.keyCode == 40) {
            // Down
            whittleImage();
        } else if (ev.keyCode == 68) {
            // d
        }
    });
    
});

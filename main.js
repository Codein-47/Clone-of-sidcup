var WS_USER = "mrmulligan";
    var selectedCategoryId = 0;
    var dateToday = new Date();
    var availableDates = [];
    var datesRetrieved = [];
    var calendarLoaded = 0;
    var timer;
    
    $(function() {
        $('a[data-toggle="pill"]').on("shown.bs.tab", function(e) {
            var categoryId = $(e.target).data("categoryid");
            checkSelectedBookAllProducts(categoryId);
        });
        
        $("#divBookAllProducts").on("change", ".baySelect", function() {
            var categoryId = parseInt($(this).data("categoryid"));
            var qty = ($(this).val() * 1);
            $("#divBookAllProductsCategory_"+categoryId+" .playerSelect").val(qty);
        });
        
        $("#divBookAllProducts").on("change", ".getProductDates", function() {
            var categoryId = parseInt($(this).data("categoryid"));
            var dateNow = (new Date()).toISOString().split("T")[0];
            datesRetrieved = [];
            getAvailableDates(categoryId, dateNow);
        });
        
        $("#divBookAllProducts").on("change", ".getProductTimes", function() {
            var categoryId = parseInt($(this).data("categoryid"));
            checkSelectedBookAllProducts(categoryId);
        });
        
         $("#divBookAllProducts").on("change", ".selectProductTime", function() {
            var categoryId = parseInt($(this).data("categoryid"));
            selectProductTime(categoryId);
        });
        
        
    });
    
    function getAvailableDates(categoryId, date) {
        var locationId = $("#locationId").val();
        
        var products = {};
        var key = 0;
        var allProductsSelected = true;
        $("#divBookAllProductsCategory_"+categoryId+" [id^='productQty_']").each(function() {
            var productId = parseInt($(this).data("productid"));
            var qty = ($(this).val() * 1);
            if(qty == 0) allProductsSelected = false;
            
            products[key] = {};
            products[key]["productId"] = productId;
            products[key]["qty"] = qty;
            
            key++;
        });
        
        if(allProductsSelected) {
            if(calendarLoaded == 0) {
                loadCalendar(categoryId, date);
                calendarLoaded = 1;
            }
            
            arrDate = date.split("-");
            year = arrDate[0];
            month = arrDate[1];
            day = arrDate[2];
            yearMonth = year+"_"+month;
            
            if(!(yearMonth in datesRetrieved)) {
                $("#bookAllProductsDatepicker_"+categoryId).attr("placeholder", "Loading...");
                $.ajax({
                    url: "/booking/ajaxGrouped.php",
                    method: "GET",
                    async: true,
                    data: { "getGroupDates":1, "locationId":locationId, "newDate":date, "products":products },
                    dataType: "json",
                    success: function(data) {
                        if(data != "" && data != null) {
                            var previousDates = availableDates;
                            var recentDates = data;
                            
                            datesRetrieved[yearMonth] = yearMonth;
                            availableDates = previousDates.concat(recentDates);
                        } else {
                            availableDates = [];
                        }
                        $("#bookAllProductsDatepicker_"+categoryId).attr("placeholder", "Select a date");
                        $("#bookAllProductsDatepicker_"+categoryId).datepicker("refresh");
                    },
                    fail: function() {
                        
                    }
                });
            }
        }
    }
    
    function loadCalendar(categoryId, firstAvailableDate) {
        $("#bookAllProductsDatepicker_"+categoryId).datepicker({
            dateFormat: "dd/mm/yy",
            minDate: 0,
            firstDay: 1,
            prevText: "",
            nextText: "",
            altField: "#bookAllProductsDate_"+categoryId,
            altFormat: "yy-mm-dd",
            dayNamesMin: [ "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT" ],
            beforeShow: function(input, inst) {
                $("#ui-datepicker-div").addClass("category-ui-picker ll-skin-melon");
            },
            beforeShowDay: function(date) {
                var string = $.datepicker.formatDate("yy-mm-dd", date);
                var thisdate = new Date(date);
                var isAvailable = ($.inArray(string, availableDates) != -1);
                
                if(isAvailable) {
                    return string;
                } else {
                    if(thisdate < dateToday) {
                        return [false, "ui-datepicker-unavailable-mobile-only"];
                    } else {
                        return true;
                    }
                }
            },
            onChangeMonthYear: function(year, month, inst) {				
                $("#bookAllProductsDatepicker_"+categoryId).datepicker("refresh");
                if(calendarLoaded == 1) {
                    var nextDate = year+"-"+pad(month, 2)+"-01";
                    getAvailableDates(categoryId, nextDate);
                }
            },
        });
        
        calendarLoaded = 1;
    }
    
    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }
    
    function checkSelectedBookAllProducts(categoryId) {
        selectedCategoryId = categoryId;
        
        var selectedDate = $("#bookAllProductsDate_"+categoryId).val();
        if(selectedDate == "") return;
        
        var products = [];
        var key = 0;
        var bayQty = 0;
        var allProductsSelected = true;
        $("#divBookAllProductsCategory_"+categoryId+" [id^='productQty_']").each(function() {
            var productId = parseInt($(this).data("productid"));
            var isBayProduct = parseInt($(this).data("isbayproduct"));
            var qty = ($(this).val() * 1);
            
            // Must select both products
            if(qty == 0) allProductsSelected = false;
            
            if(isBayProduct) bayQty = qty;
            
            if(isBayProduct && qty > 1) {
                for(var i = 1; i <= qty; i++) {
                    products[key] = productId+"_1";
                    key++
                }
            } else {
                products[key] = productId+"_"+qty;
                key++
            }
        });
        
        if(allProductsSelected) {
            $("#divBookAllProductsError_"+categoryId).html("").slideUp();
            $("#bookAllProductsTime_"+categoryId).html("<option>Loading...</option>");
            if(bayQty > 3) $("#divSelectBay_"+categoryId).html("").slideUp();
            $("#btnConfirmBooking").addClass("disabled").siblings(".overlay").removeClass("d-none");
            
            clearTimeout(timer);
            timer = setTimeout(function () {
                getBookAllProductsTimes(categoryId, products, bayQty);
            }, 1500);
        }
    }
    
    function getBookAllProductsTimes(categoryId, products, bayQty) {
        var locationId = $("#locationId").val();
        var selectedDate = $("#bookAllProductsDate_"+categoryId).val();
        var selectedProducts = parseInt(products.length);
        var productsError = "";
        var now = new Date();
        
        if(selectedProducts > 0) {
            $.ajax({
                url: "/booking/ajaxGrouped.php",
                method: "POST",
                async: true,
                data: { "getAvailableProductsTimes":1, "selectedDate":selectedDate, "categoryId":categoryId, "locationId":locationId, "products":products },
                dataType: "json",
                success: function(data) {
                    console.log("getAvailableProductsTimes results");
                    console.log(data);
                    productsError = "";
                    if(data.bookingConditionError != "") productsError = data.bookingConditionError;
                    if(productsError == "") {
                        if(data.times != "" && data.times != null) {
                            var options = "";
                            var bayOptions = [];
                            var count = bayCount = 0;
                            $.each(data.times, function(index, value) {
                                var thisDateTime = selectedDate+" "+index+":00";
                                var timeSlotDate = new Date(thisDateTime.replace(/-/g,"/"));
                                var available_linked_expids = "";
                                if (value.hasOwnProperty("available_linked_expids")) {
                                    available_linked_expids = encodeURIComponent(JSON.stringify(value.available_linked_expids));
                                }
                                
                                if((timeSlotDate.getTime() < now.getTime()) || value.available == 0) { // Time slot has passed
                                    options+= "<option value=\""+index+"\" disabled>"+index+"</option>";
                                } else if(value.available == 1) {
                                    options+= "<option value=\""+index+"\" data-availablelinkedexpids=\""+available_linked_expids+"\">"+index+"</option>";
                                }
                                
                                // Get the driving bay experiences for the first time
                                if(count == 0 && value.available_linked_expids != "" && value.available_linked_expids != null) {
                                    console.log(value.available_linked_expids);
                                    $(value.available_linked_expids).each(function(index2, val) {
                                        bayOptions[bayCount] = "<option value=\"\">Select a bay</option>";
                                        $.each(val, function(expKey, expValue) {
                                            bayOptions[bayCount] += "<option value=\""+expKey+"\">"+expValue+"</option>";
                                        });
                                        bayCount++
                                    });
                                }
                                
                                count++;
                            });
                            $("#bookAllProductsTime_"+categoryId).html(options);
                            
                            if(bayQty <= 3) {
                                var html = "";
                                var bayCount = 0;
                                $.each(data.currentBookings, function(index, value) {
                                    if(value.data.extra.DRIVINGRAN == 1) {
                                        html+= "<div class=\"row mb-2\">";
                                            html+= "<div class=\"col-12 col-sm-4 col-md-6 col-lg-6 mx-auto\">";
                                                html+= "<div class=\"d-flex align-items-center\">";
                                                    html+= "<span class=\"iconWrapper mr-3\"><img src=\"/assets/images/flag.png\" aria-hidden=\"true\"></i></span>";
                                                    html+= "<select class=\"form-control required live-validate baySelector\" id=\"baySelect_"+index+"\" data-basketkey=\""+index+"\" required>"+bayOptions[bayCount]+"</select>";
                                                html+= "</div>";
                                            html+= "</div>";
                                        html+= "</div>";
                                        bayCount++;
                                    }
                                });
                                $("#divSelectBay_"+categoryId).html(html).slideDown();
                            }
                            
                            $("#btnConfirmBooking").removeClass("disabled").siblings(".overlay").addClass("d-none");
                        } else {
                            $("#bookAllProductsTime_"+categoryId).html("<option value=\"\">Sorry, there is no availability on your chosen date - please select another date.</option>");
                        }
                    } else {
                        $("#bookAllProductsTime_"+categoryId).html("<option value=\"\">Select a Time</option>");
                        $("#divBookAllProductsError_"+categoryId).html(productsError).slideDown();
                    }
                }
            });
        }
    }
    
    function selectProductTime(categoryId){
        selectTimeElement = $('#bookAllProductsTime_'+categoryId).find(':selected');
        available_linked_expids = selectTimeElement.data("availablelinkedexpids");
    
        bayOptions = "";
        if (available_linked_expids != "" &&  available_linked_expids != null){
            available_linked_expids = JSON.parse(decodeURIComponent(available_linked_expids));
            $(available_linked_expids).each(function(index2, val) {
    
                bayOptions = "<option value=\"\">Select a bay</option>";
                $.each(val, function(expKey, expValue) {
                    bayOptions += "<option value=\""+expKey+"\">"+expValue+"</option>";
                });
            });
        }
        $(".baySelector").html(bayOptions);
    }
    
    function confirmBooking(categoryId) {
        var date = $("#bookAllProductsDate_"+categoryId).val();
        var time = $("#bookAllProductsTime_"+categoryId).val();
        var qty = 1;
        
        var fixexpid = [];
        $("#divSelectBay_"+categoryId+" select[id^='baySelect_']").each(function() {
            var basketKey = parseInt($(this).data("basketkey"));
            var experienceId = parseInt($(this).val());
            
            if(experienceId > 0) fixexpid[basketKey] = experienceId;
        });
        
        $.ajax({
            url: "/booking/ajaxGrouped.php",
            method: "GET",
            async: true,
            data: { "setTime":1, "date":date, "time":time, "qty":qty, "fixexpid":fixexpid },
            dataType: "json",
            success: function(data) {
                if(data != "" && data != null && data.error != 1) {
                    if(data.redirect != "" && data.redirect != undefined) {
                        window.location.href = data.redirect;
                    } else {
                        checkNextItem();
                    }
                } else {
                    $("#divBookAllProductsError_"+categoryId).html("There has been a problem with completing your booking. Please try again.").slideDown();
                }
            },
            fail: function() {
                $("#divBookAllProductsError_"+categoryId).html("There has been a problem with completing your booking. Please try again.").slideDown();
            }
        });
    }
    
    function checkNextItem() {
        $.ajax({
            url: "/booking/ajaxGrouped.php",
            method: "GET",
            async: true,
            data: { "checkNextItem":1 },
            dataType: "json",
            success: function(data) {
                getCurrentActivities();
            }
        });
    }
    
    function getCurrentActivities() {
        $.ajax({
            url: "/booking/ajaxGrouped.php",
            method: "GET",
            async: true,
            data: { "getCurrentActivities":1 },
            dataType: "json",
            success: function(data) {
                if(data != "" && data != null) {
                    if(data.allDone) {
                        window.location.href = "/booking/activityGrouped.php?addAllToBasket=1";
                    }
                }
            }
        });
    }
    $(function(){
        $("#header").on({
            mouseenter: function() {
                $('#header').addClass('hover');
            },
            mouseleave: function() {
                $('#header').removeClass('hover');
            }
        });
    });
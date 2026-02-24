package tr.org.lider.dto;

import java.util.Date;
import java.util.Optional;

import org.springframework.format.annotation.DateTimeFormat;

public class OperationLogDTO {
	private int pageNumber;
	private int pageSize;
	private  String operationType;
	private String field;
	private String searchText;
    private String userId;
    private String requestIp;
    @DateTimeFormat(pattern = "dd/MM/yyyy HH:mm:ss")
	private Optional<Date> startDate;
    @DateTimeFormat(pattern = "dd/MM/yyyy HH:mm:ss")
	private Optional<Date> endDate;
	
	public int getPageNumber() {
		return pageNumber;
	}
	public void setPageNumber(int pageNumber) {
		this.pageNumber = pageNumber;
	}
	public int getPageSize() {
		return pageSize;
	}
	public void setPageSize(int pageSize) {
		this.pageSize = pageSize;
	}
	public String getOperationType() {
		return operationType;
	}
	public void setOperationType(String operationType) {
		this.operationType = operationType;
	}
	public String getField() {
		return field;
	}
	public void setField(String field) {
		this.field = field;
	}
	public String getSearchText() {
		return searchText;
	}
	public void setSearchText(String searchText) {
		this.searchText = searchText;
	}
	public Optional<Date> getStartDate() {
		return startDate;
	}
	public void setStartDate(Optional<Date> startDate) {
		this.startDate = startDate;
	}
	public Optional<Date> getEndDate() {
		return endDate;
	}
	public void setEndDate(Optional<Date> endDate) {
		this.endDate = endDate;
	}
	public String getUserId() {
		return userId;
	}
	public void setUserId(String userId) {
		this.userId = userId;
	}
	public String getRequestIp() {
		return requestIp;
	}
	public void setRequestIp(String requestIp) {
		this.requestIp = requestIp;
	}

}

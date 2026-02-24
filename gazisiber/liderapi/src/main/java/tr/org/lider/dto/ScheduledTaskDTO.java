package tr.org.lider.dto;

import java.util.Date;
import java.util.Optional;

import org.springframework.format.annotation.DateTimeFormat;

public class ScheduledTaskDTO {

	private int pageNumber;
    private int pageSize;
    private Optional <Boolean> status;
	private Optional<String> taskCommand;
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
	public Optional<String> getTaskCommand() {
		return taskCommand;
	}
	public void setTaskCommand(Optional<String> taskCommand) {
		this.taskCommand = taskCommand;
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
	public Optional <Boolean> getStatus() {
		return status;
	}
	public void setStatus(Optional <Boolean> status) {
		this.status = status;
	}

}
